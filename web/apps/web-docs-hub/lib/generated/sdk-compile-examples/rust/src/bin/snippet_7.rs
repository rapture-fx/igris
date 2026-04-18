use igris_inertial::{IgrisClient, InferRequest, Message};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = IgrisClient::builder("https://overture.igrisinertial.com")
        .api_key(std::env::var("IGRIS_API_KEY")?)
        .build()?;

    let response = client
        .infer(&InferRequest {
            model: "gpt-4".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
                content_parts: None,
            }],
            ..Default::default()
        })
        .await?;

    println!("{}", response.choices[0].message.content);
    Ok(())
}
