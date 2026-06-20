use anyhow::{anyhow, Context, Result};
use serde_json::Value;

use super::api::Client;
use super::resolve_api_url;

/// `igris agents list`
pub async fn run_list(api_url: Option<String>, include_archived: bool) -> Result<()> {
    let api = resolve_api_url(&api_url);
    let client = Client::new(&api)?;
    let payload = client.list_agents(include_archived).await?;
    let agents = payload
        .get("agents")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if agents.is_empty() {
        println!("No registered agents found.");
        return Ok(());
    }
    for agent in agents {
        let id = agent.get("agent_id").and_then(Value::as_str).unwrap_or("—");
        let name = agent.get("name").and_then(Value::as_str).unwrap_or("—");
        let display = agent
            .get("display_name")
            .and_then(Value::as_str)
            .unwrap_or(name);
        let agent_type = agent
            .get("agent_type")
            .and_then(Value::as_str)
            .unwrap_or("—");
        println!("{id}\t{name}\t{display}\t{agent_type}");
    }
    Ok(())
}

/// `igris agents register`
pub async fn run_register(api_url: Option<String>, body: &Value) -> Result<()> {
    let api = resolve_api_url(&api_url);
    let client = Client::new(&api)?;
    let created = client.register_agent(body).await?;
    let id = created
        .get("agent_id")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let name = created
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    println!("Registered agent {name} ({id})");
    Ok(())
}

/// `igris agents show <id-or-name>`
pub async fn run_show(api_url: Option<String>, id_or_name: &str) -> Result<()> {
    let api = resolve_api_url(&api_url);
    let client = Client::new(&api)?;
    let agent = client.get_agent(id_or_name).await?;
    println!(
        "{}",
        serde_json::to_string_pretty(&agent).context("could not format agent response")?
    );
    Ok(())
}

/// `igris agents archive <id>`
pub async fn run_archive(api_url: Option<String>, id: &str) -> Result<()> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("agent id is required"));
    }
    let api = resolve_api_url(&api_url);
    let client = Client::new(&api)?;
    client.archive_agent(trimmed).await?;
    println!("Archived agent {trimmed}");
    Ok(())
}

pub fn build_register_body(
    name: &str,
    agent_type: &str,
    display_name: Option<&str>,
    template_name: Option<&str>,
    version: Option<&str>,
    description: Option<&str>,
) -> Result<Value> {
    let name = name.trim();
    if name.is_empty() {
        return Err(anyhow!("--name is required"));
    }
    let agent_type = agent_type.trim();
    if agent_type.is_empty() {
        return Err(anyhow!("--agent-type is required"));
    }
    let mut body = serde_json::json!({
        "name": name,
        "agent_type": agent_type,
    });
    if let Some(value) = display_name.filter(|v| !v.trim().is_empty()) {
        body["display_name"] = value.trim().into();
    }
    if let Some(value) = template_name.filter(|v| !v.trim().is_empty()) {
        body["template_name"] = value.trim().into();
    }
    if let Some(value) = version.filter(|v| !v.trim().is_empty()) {
        body["version"] = value.trim().into();
    }
    if let Some(value) = description.filter(|v| !v.trim().is_empty()) {
        body["description"] = value.trim().into();
    }
    Ok(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_register_body_requires_name_and_type() {
        assert!(build_register_body("", "cursor", None, None, None, None).is_err());
        let body = build_register_body("support-bot", "cursor", None, None, None, None).unwrap();
        assert_eq!(body["name"], "support-bot");
        assert_eq!(body["agent_type"], "cursor");
    }
}
