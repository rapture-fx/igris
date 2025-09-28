//! Error types for the Schlep-engine Rust SDK.

use thiserror::Error;

/// Result type alias for SDK operations.
pub type Result<T> = std::result::Result<T, Error>;

/// Error types that can occur when using the Schlep-engine SDK.
#[derive(Error, Debug)]
pub enum Error {
    /// HTTP request failed.
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    /// Invalid API response.
    #[error("Invalid API response: {0}")]
    InvalidResponse(String),

    /// API returned an error response.
    #[error("API error {code}: {message}")]
    Api { code: u16, message: String },

    /// Configuration error.
    #[error("Configuration error: {0}")]
    Config(String),

    /// Serialization/deserialization error.
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// URL parsing error.
    #[error("URL parsing error: {0}")]
    UrlParse(#[from] url::ParseError),

    /// WebSocket error.
    #[error("WebSocket error: {0}")]
    WebSocket(String),
}

impl Error {
    /// Create a new API error.
    pub fn api_error(code: u16, message: impl Into<String>) -> Self {
        Self::Api {
            code,
            message: message.into(),
        }
    }

    /// Create a new configuration error.
    pub fn config_error(message: impl Into<String>) -> Self {
        Self::Config(message.into())
    }

    /// Create a new invalid response error.
    pub fn invalid_response(message: impl Into<String>) -> Self {
        Self::InvalidResponse(message.into())
    }
}