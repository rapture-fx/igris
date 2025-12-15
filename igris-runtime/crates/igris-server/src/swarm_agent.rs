use anyhow::Result;
use futures::future::join_all;
use igris_mcp_server::protocol::ContextMessage;
use igris_mcp_server::ContextStore;
use igris_reflection::LLMProvider;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::{debug, info, warn};

#[derive(Debug, Clone)]
pub struct SwarmConfig {
    pub size: usize,
    pub max_concurrent: usize,
    pub agent_timeout_ms: u64,
}

#[derive(Debug, Clone)]
struct RoleSpec {
    name: &'static str,
    system: &'static str,
}

fn default_roles() -> Vec<RoleSpec> {
    vec![
        RoleSpec {
            name: "researcher",
            system: "You are a researcher. Find key facts, constraints, and edge cases. Be concise and actionable.",
        },
        RoleSpec {
            name: "engineer",
            system: "You are an engineer. Propose an implementation plan and potential pitfalls. Be specific.",
        },
        RoleSpec {
            name: "critic",
            system: "You are a critic. Look for flaws, missing requirements, and unsafe assumptions. Be strict.",
        },
        RoleSpec {
            name: "synthesizer",
            system: "You are a synthesizer. Combine inputs into a single best final answer. Resolve conflicts and be definitive.",
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

pub async fn run_swarm(
    cfg: SwarmConfig,
    provider: Arc<dyn LLMProvider>,
    context_store: Option<Arc<ContextStore>>,
    conversation_id: String,
    peer_id: String,
    user_prompt: &str,
) -> Result<String> {
    let roles = default_roles();
    let n = cfg.size.clamp(1, 50);
    let max_conc = cfg.max_concurrent.max(1);
    info!(
        "Swarm starting: size={}, max_concurrent={}, conversation_id={}",
        n, max_conc, conversation_id
    );

    // Expand roles to N agents by cycling role list.
    let mut agent_specs = Vec::with_capacity(n);
    for i in 0..n {
        let role = &roles[i % roles.len()];
        agent_specs.push((i, role.clone()));
    }

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

        futures.push(async move {
            let _permit = sem.acquire().await.expect("semaphore closed");
            let name = format!("{}-{}", role.name, idx);
            debug!("Swarm agent {} starting", name);

            let gen = provider.generate(&prompt);
            let out = match tokio::time::timeout(std::time::Duration::from_millis(timeout_ms), gen).await
            {
                Ok(Ok(s)) => Ok(s),
                Ok(Err(e)) => Err(anyhow::anyhow!("agent {} failed: {}", name, e)),
                Err(_) => Err(anyhow::anyhow!("agent {} timed out after {}ms", name, timeout_ms)),
            }?;

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

    // Always synthesize with a final LLM call.
    let synth = synthesis_prompt(user_prompt, &contributions);
    let final_answer = provider.generate(&synth).await?;

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


