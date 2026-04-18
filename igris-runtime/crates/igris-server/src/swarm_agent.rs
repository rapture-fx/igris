use anyhow::Result;
use futures::future::join_all;
use igris_mcp_server::protocol::ContextMessage;
use igris_mcp_server::ContextStore;
use igris_reflection::LLMProvider;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, Semaphore};
use tracing::{debug, info, warn};

#[derive(Debug, Clone)]
pub struct SwarmConfig {
    pub size: usize,
    pub max_concurrent: usize,
    pub agent_timeout_ms: u64,
    pub dynamic_roles: bool,
    pub enable_bus: bool,
    pub consensus_candidates: usize,
}

#[derive(Debug, Clone)]
struct RoleSpec {
    name: String,
    system: String,
}

fn default_roles() -> Vec<RoleSpec> {
    vec![
        RoleSpec {
            name: "researcher".to_string(),
            system: "You are a researcher. Find key facts, constraints, and edge cases. Be concise and actionable.".to_string(),
        },
        RoleSpec {
            name: "engineer".to_string(),
            system: "You are an engineer. Propose an implementation plan and potential pitfalls. Be specific.".to_string(),
        },
        RoleSpec {
            name: "critic".to_string(),
            system: "You are a critic. Look for flaws, missing requirements, and unsafe assumptions. Be strict.".to_string(),
        },
        RoleSpec {
            name: "synthesizer".to_string(),
            system: "You are a synthesizer. Combine inputs into a single best final answer. Resolve conflicts and be definitive.".to_string(),
        },
    ]
}

fn now_ts() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn role_prompt(role: &RoleSpec, user_prompt: &str) -> String {
    format!(
        "SYSTEM:\n{}\n\nUSER REQUEST:\n{}\n\nRespond with your contribution only.",
        role.system, user_prompt
    )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DynamicRoleSpec {
    name: String,
    system: String,
}

async fn choose_roles(
    cfg: &SwarmConfig,
    provider: Arc<dyn LLMProvider>,
    user_prompt: &str,
) -> Vec<RoleSpec> {
    if !cfg.dynamic_roles {
        return default_roles();
    }

    let prompt = format!(
        r#"You are configuring a multi-agent swarm. Return JSON ONLY.

Given the USER REQUEST, propose 4-8 agent roles to solve it well.
Each role MUST have:
- name: short identifier (kebab-case)
- system: system instruction for that agent

Return:
{{"roles":[{{"name":"...","system":"..."}}, ...]}}

USER REQUEST:
{}"#,
        user_prompt
    );

    let raw = match provider.generate(&prompt).await {
        Ok(s) => s,
        Err(e) => {
            warn!("Dynamic role assignment failed, using defaults: {}", e);
            return default_roles();
        }
    };

    let json = super_extract_first_json_object(&raw);
    let roles = json
        .and_then(|v| v.get("roles").cloned())
        .and_then(|v| serde_json::from_value::<Vec<DynamicRoleSpec>>(v).ok());

    match roles {
        Some(rs) if !rs.is_empty() => rs
            .into_iter()
            .take(8)
            .map(|r| RoleSpec {
                name: r.name,
                system: r.system,
            })
            .collect(),
        _ => {
            warn!("Dynamic role assignment returned invalid JSON; using defaults");
            default_roles()
        }
    }
}

fn synthesis_prompt(user_prompt: &str, contributions: &[(String, String)]) -> String {
    let mut body = String::new();
    for (role, text) in contributions {
        body.push_str(&format!("\n## {}\n{}\n", role, text));
    }

    format!(
        "SYSTEM:\nYou are a synthesizer. Produce the final answer.\n\nUSER REQUEST:\n{}\n\nCONTRIBUTIONS:{}\n\nFINAL ANSWER:",
        user_prompt, body
    )
}

fn consensus_candidate_prompt(
    kind: &str,
    user_prompt: &str,
    contributions: &[(String, String)],
) -> String {
    let mut body = String::new();
    for (role, text) in contributions {
        body.push_str(&format!("\n## {}\n{}\n", role, text));
    }

    match kind {
        "balanced" => format!(
            "SYSTEM:\nYou are a lead synthesizer. Produce the best final answer.\n\nUSER REQUEST:\n{}\n\nCONTRIBUTIONS:{}\n\nFINAL ANSWER:",
            user_prompt, body
        ),
        "safety" => format!(
            "SYSTEM:\nYou are a safety-focused synthesizer. Avoid unsafe assumptions and state uncertainties.\n\nUSER REQUEST:\n{}\n\nCONTRIBUTIONS:{}\n\nFINAL ANSWER:",
            user_prompt, body
        ),
        "strict" => format!(
            "SYSTEM:\nYou are a strict reviewer. Only include claims supported by the contributions.\n\nUSER REQUEST:\n{}\n\nCONTRIBUTIONS:{}\n\nFINAL ANSWER:",
            user_prompt, body
        ),
        _ => synthesis_prompt(user_prompt, contributions),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JudgePick {
    winner_index: usize,
}

async fn pick_consensus(
    provider: Arc<dyn LLMProvider>,
    user_prompt: &str,
    candidates: &[String],
) -> String {
    if candidates.is_empty() {
        return String::new();
    }
    if candidates.len() == 1 {
        return candidates[0].clone();
    }

    let mut body = String::new();
    for (i, c) in candidates.iter().enumerate() {
        body.push_str(&format!("\n## Candidate {}\n{}\n", i, c));
    }

    let prompt = format!(
        r#"You are selecting the best final answer. Return JSON ONLY: {{"winner_index":N}}

Pick the candidate that best answers the USER REQUEST with correctness, completeness, and clarity.

USER REQUEST:
{}

CANDIDATES:
{}"#,
        user_prompt, body
    );

    let raw = match provider.generate(&prompt).await {
        Ok(s) => s,
        Err(e) => {
            warn!("Consensus judge failed; using candidate 0: {}", e);
            return candidates[0].clone();
        }
    };

    let json = super_extract_first_json_object(&raw);
    let pick = json.and_then(|v| serde_json::from_value::<JudgePick>(v).ok());
    match pick {
        Some(p) if p.winner_index < candidates.len() => candidates[p.winner_index].clone(),
        _ => candidates[0].clone(),
    }
}

pub async fn run_swarm(
    cfg: SwarmConfig,
    provider: Arc<dyn LLMProvider>,
    context_store: Option<Arc<ContextStore>>,
    conversation_id: String,
    peer_id: String,
    user_prompt: &str,
) -> Result<String> {
    let n = cfg.size.clamp(1, 50);
    let max_conc = cfg.max_concurrent.max(1);
    info!(
        "Swarm starting: size={}, max_concurrent={}, conversation_id={}",
        n, max_conc, conversation_id
    );

    let roles = choose_roles(&cfg, provider.clone(), user_prompt).await;

    // Expand roles to N agents by cycling role list.
    let mut agent_specs = Vec::with_capacity(n);
    for i in 0..n {
        let role = &roles[i % roles.len()];
        agent_specs.push((i, role.clone()));
    }

    let (bus_tx, _) = broadcast::channel::<String>(256);
    let sem = Arc::new(Semaphore::new(max_conc));
    let mut futures = Vec::with_capacity(n);

    for (idx, role) in agent_specs {
        let provider = provider.clone();
        let sem = sem.clone();
        let store = context_store.clone();
        let conv = conversation_id.clone();
        let peer = peer_id.clone();
        let prompt = role_prompt(&role, user_prompt);
        let timeout_ms = cfg.agent_timeout_ms;
        let mut bus_rx = bus_tx.subscribe();
        let bus_tx = bus_tx.clone();
        let enable_bus = cfg.enable_bus;

        futures.push(async move {
            let _permit = sem.acquire().await.expect("semaphore closed");
            let name = format!("{}-{}", role.name, idx);
            debug!("Swarm agent {} starting", name);

            // Phase 1: initial contribution.
            let gen1 = provider.generate(&prompt);
            let out1 = match tokio::time::timeout(std::time::Duration::from_millis(timeout_ms), gen1).await {
                Ok(Ok(s)) => Ok(s),
                Ok(Err(e)) => Err(anyhow::anyhow!("agent {} failed: {}", name, e)),
                Err(_) => Err(anyhow::anyhow!("agent {} timed out after {}ms", name, timeout_ms)),
            }?;

            if enable_bus {
                let _ = bus_tx.send(format!("{}:\n{}", name, out1));
            }

            // Phase 2: refine using other agents' notes (inter-agent communication).
            let out = if enable_bus {
                let mut notes = String::new();
                // Drain a bounded number of messages quickly.
                for _ in 0..16 {
                    match tokio::time::timeout(std::time::Duration::from_millis(50), bus_rx.recv()).await {
                        Ok(Ok(m)) => {
                            if !m.starts_with(&format!("{}:", name)) {
                                notes.push_str("\n---\n");
                                notes.push_str(&m);
                            }
                        }
                        _ => break,
                    }
                }

                if notes.is_empty() {
                    out1.clone()
                } else {
                    let refine_prompt = format!(
                        "SYSTEM:\n{}\n\nUSER REQUEST:\n{}\n\nOTHER AGENT NOTES:{}\n\n\
                         Revise or extend your contribution. Provide only your improved contribution.",
                        role.system, user_prompt, notes
                    );
                    match tokio::time::timeout(
                        std::time::Duration::from_millis(timeout_ms),
                        provider.generate(&refine_prompt),
                    )
                    .await
                    {
                        Ok(Ok(s)) => s,
                        _ => out1.clone(),
                    }
                }
            } else {
                out1.clone()
            };

            if let Some(store) = store {
                let _ = store
                    .add_message(
                        conv.clone(),
                        ContextMessage {
                            role: format!("swarm/{}", name),
                            content: out.clone(),
                            timestamp: now_ts(),
                            peer_id: peer.clone(),
                        },
                    )
                    .await;
            }

            Ok::<(String, String), anyhow::Error>((role.name.to_string(), out))
        });
    }

    let results = join_all(futures).await;
    let mut contributions: Vec<(String, String)> = Vec::new();
    for r in results {
        match r {
            Ok(ok) => contributions.push(ok),
            Err(e) => warn!("Swarm agent error: {}", e),
        }
    }

    if contributions.is_empty() {
        anyhow::bail!("Swarm produced no contributions");
    }

    // Consensus: produce N candidate syntheses and pick a winner.
    let k = cfg.consensus_candidates.clamp(1, 5);
    let kinds = ["balanced", "safety", "strict", "balanced", "strict"];
    let mut candidates = Vec::with_capacity(k);
    for i in 0..k {
        let p = consensus_candidate_prompt(kinds[i], user_prompt, &contributions);
        match provider.generate(&p).await {
            Ok(s) => candidates.push(s),
            Err(e) => warn!("Consensus candidate generation failed: {}", e),
        }
    }
    if candidates.is_empty() {
        // Fallback to a single synthesis prompt.
        let synth = synthesis_prompt(user_prompt, &contributions);
        candidates.push(provider.generate(&synth).await?);
    }
    let final_answer = pick_consensus(provider.clone(), user_prompt, &candidates).await;

    if let Some(store) = context_store {
        let _ = store
            .add_message(
                conversation_id,
                ContextMessage {
                    role: "swarm/final".to_string(),
                    content: final_answer.clone(),
                    timestamp: now_ts(),
                    peer_id,
                },
            )
            .await;
    }

    Ok(final_answer)
}

// Minimal JSON object extraction (mirrors the ToolAgent approach; local to swarm module).
fn super_extract_first_json_object(s: &str) -> Option<serde_json::Value> {
    let mut start: Option<usize> = None;
    let mut depth: i32 = 0;
    let mut in_string = false;
    let mut escape = false;

    for (idx, ch) in s.char_indices() {
        if start.is_none() {
            if ch == '{' {
                start = Some(idx);
                depth = 1;
                in_string = false;
                escape = false;
            }
            continue;
        }

        if in_string {
            if escape {
                escape = false;
                continue;
            }
            match ch {
                '\\' => escape = true,
                '"' => in_string = false,
                _ => {}
            }
            continue;
        }

        match ch {
            '"' => in_string = true,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    let begin = start?;
                    let end = idx + ch.len_utf8();
                    let slice = &s[begin..end];
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(slice) {
                        if val.is_object() {
                            return Some(val);
                        }
                    }
                    start = None;
                }
            }
            _ => {}
        }
    }

    None
}
