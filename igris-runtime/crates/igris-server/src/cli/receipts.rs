use anyhow::{anyhow, Result};

use super::api::Client;
use super::tasks::print_verify_result;

/// `igris-runtime receipts verify <execution_id>` — calls
/// POST /proof/receipts/verify. The verify endpoint keys on `execution_id`;
/// `<receipt_id>` and `<hash>` are not directly accepted by the API, so we
/// name the argument `execution_id` to match what the server expects.
pub async fn run_verify(api_url: &str, execution_id: &str) -> Result<()> {
    let client = Client::new(api_url)?;
    let result = client.verify_receipt(execution_id).await?;
    print_verify_result(&result);
    if !result
        .get("verified")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(anyhow!("receipt did not verify"));
    }
    Ok(())
}
