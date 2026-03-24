// Igris Inertial — Rust hello world
// Requires: cargo add igris-inertial
//
// Usage:
//   export IGRIS_API_KEY=igris_...
//   cargo run

use igris_inertial::{IgrisClient, InferRequest, Message};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = std::env::var("IGRIS_API_KEY")
        .expect("Set IGRIS_API_KEY first: export IGRIS_API_KEY=igris_...");

    let client = IgrisClient::builder("https://overture.igrisinertial.com")
        .api_key(api_key)
        .build()?;

    let response = client
        .infer(&InferRequest {
            model: "gpt-4".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello! Reply in one sentence.".to_string(),
                ..Default::default()
            }],
            max_tokens: Some(64),
            ..Default::default()
        })
        .await?;

    println!("{}", response.choices[0].message.content);
    if let Some(meta) = &response.metadata {
        println!("Provider : {}", meta.provider);
        println!("Latency  : {} ms", meta.latency_ms);
        println!("Cost     : ${:.6}", meta.cost_usd);
    }

    Ok(())
}
