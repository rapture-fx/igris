use anyhow::Result;

use super::api::Client;

/// `igris-runtime auth login` — validate the configured API key by hitting an
/// authenticated endpoint. Never prints the key itself. Exits non-zero if the
/// env var is missing or the key is rejected.
pub async fn run_login(api_url: &str) -> Result<()> {
    // Construct the client; this also surfaces the "IGRIS_API_KEY unset"
    // message with actionable guidance if applicable.
    let client = Client::new(api_url)?;
    println!("Validating API key against {}...", client.base());
    client.ping_authenticated().await?;
    println!("Authenticated.");
    Ok(())
}
