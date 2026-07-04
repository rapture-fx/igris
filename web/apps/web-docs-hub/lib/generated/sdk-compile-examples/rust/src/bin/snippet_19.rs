use igris_inertial::IgrisClient;

pub fn create_igris_client() -> Result<IgrisClient, Box<dyn std::error::Error>> {
    let base_url = std::env::var("IGRIS_BASE_URL")
        .unwrap_or_else(|_| "https://overture.igrisinertial.com".to_string());

    let api_key = std::env::var("IGRIS_API_KEY")?;

    Ok(
        IgrisClient::builder(&base_url)
            .api_key(api_key)
            .build()?
    )
}

fn main() {}
