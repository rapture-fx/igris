use igris_inertial::IgrisClient;

fn create_client() -> Result<IgrisClient, Box<dyn std::error::Error>> {
    Ok(IgrisClient::builder("https://overture.igrisinertial.com")
        .api_key(std::env::var("IGRIS_API_KEY")?)
        .build()?)
}

fn main() {}
