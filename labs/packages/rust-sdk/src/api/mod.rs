//! API modules for the Schlep-engine Rust SDK.
//!
//! This module contains all API client implementations for different
//! Schlep-engine services organized by functionality.

pub mod data;
pub mod ml;
pub mod analytics;
pub mod document;
pub mod quality;
pub mod storage;
pub mod monitoring;
pub mod users;
pub mod admin;

pub use data::DataClient;
pub use ml::MLClient;
pub use analytics::AnalyticsClient;
pub use document::DocumentClient;
pub use quality::QualityClient;
pub use storage::StorageClient;
pub use monitoring::MonitoringClient;
pub use users::UsersClient;
pub use admin::AdminClient;
