//! Predictive Intelligence Layer (Phase 11.2)
//!
//! Forecasts future system states and proactively adjusts policies
//! before performance degradation occurs.
//!
//! # Architecture
//! ```text
//! Telemetry → Horizon Model → Forecast → Proactive Adjuster → Policy
//!     ↓            ↓              ↓              ↓
//!  Historical   LSTM-like    Future State   Pre-emptive
//!   Patterns    Forecaster   Prediction     Adjustment
//! ```
//!
//! # Key Features
//! - Traffic pattern forecasting (1-60 minute horizon)
//! - Proactive policy adjustment before load spikes
//! - Anomaly prediction and pre-emptive rollback
//! - Confidence-weighted forecasts

pub mod horizon_model;
pub mod proactive_adjuster;
pub mod forecast_engine;

pub use horizon_model::{HorizonModel, ForecastHorizon, TimeSeriesData};
pub use proactive_adjuster::{ProactiveAdjuster, ProactiveDecision, AdjustmentConfig};
pub use forecast_engine::{ForecastEngine, ForecastResult, ForecastMetrics};
