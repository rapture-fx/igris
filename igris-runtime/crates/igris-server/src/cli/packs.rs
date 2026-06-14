use anyhow::{Context, Result};

use super::api::Client;

/// `igris packs list`
pub async fn run_list(api_url: &str) -> Result<()> {
    let client = Client::new(api_url)?;
    let body = client.list_action_packs().await?;
    let packs = body
        .get("packs")
        .and_then(|v| v.as_array())
        .ok_or_else(|| anyhow::anyhow!("unexpected action-packs response shape"))?;
    if packs.is_empty() {
        println!("No built-in Action Packs are available.");
        return Ok(());
    }
    for pack in packs {
        let name = pack.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let display = pack
            .get("display_name")
            .and_then(|v| v.as_str())
            .unwrap_or(name);
        let count = pack
            .get("action_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let description = pack
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        println!("{display} ({name}) — {count} actions");
        if !description.is_empty() {
            println!("  {description}");
        }
    }
    Ok(())
}

/// `igris packs install <name>`
pub async fn run_install(api_url: &str, pack_name: &str) -> Result<()> {
    let client = Client::new(api_url)?;
    let body = client
        .install_action_pack(pack_name)
        .await
        .with_context(|| format!("install Action Pack `{pack_name}`"))?;
    let created = body
        .get("created")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let skipped = body
        .get("skipped")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if created.is_empty() && skipped.is_empty() {
        println!("Action Pack `{pack_name}` install finished with no changes.");
        return Ok(());
    }
    if !created.is_empty() {
        println!("Installed actions: {}", created.join(", "));
    }
    if !skipped.is_empty() {
        println!("Skipped (already registered): {}", skipped.join(", "));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn pack_list_parses_empty_shape() {
        let body = serde_json::json!({ "packs": [] });
        let packs = body.get("packs").and_then(|v| v.as_array()).unwrap();
        assert!(packs.is_empty());
    }
}