use anyhow::{bail, Result};
use igris_core::config::IgrisConfig;

#[derive(Debug, Clone, Copy)]
pub(crate) struct RuntimeSecurityPolicy {
    pub(crate) allow_insecure_dev_mode: bool,
    pub(crate) runtime_submission_api_enabled: bool,
}

impl RuntimeSecurityPolicy {
    pub(crate) fn from_env() -> Self {
        Self {
            allow_insecure_dev_mode: env_flag("IGRIS_ALLOW_INSECURE_DEV_MODE"),
            runtime_submission_api_enabled: env_flag_with_default(
                "IGRIS_ENABLE_RUNTIME_SUBMISSION_API",
                true,
            ),
        }
    }
}

pub(crate) fn validate_runtime_security_config(
    config: &IgrisConfig,
    policy: RuntimeSecurityPolicy,
    overture_public_key_present: bool,
) -> Result<()> {
    if policy.allow_insecure_dev_mode {
        return Ok(());
    }

    if !config.auth.enabled {
        bail!(
            "self-serve boot blocked: auth.enabled=false. Set a real auth method or use IGRIS_ALLOW_INSECURE_DEV_MODE=true for local development only"
        );
    }

    if !config.auth.has_auth_method() {
        bail!(
            "self-serve boot blocked: no auth method configured. Set IGRIS_RUNTIME_SECRET, auth.api_key, or auth.jwt_hs256_secret"
        );
    }

    if policy.runtime_submission_api_enabled && !overture_public_key_present {
        bail!(
            "self-serve boot blocked: IGRIS_OVERTURE_PUBLIC_KEY is required while runtime submission endpoints are enabled"
        );
    }

    Ok(())
}

fn env_flag(name: &str) -> bool {
    env_flag_with_default(name, false)
}

fn env_flag_with_default(name: &str, default: bool) -> bool {
    std::env::var(name)
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_config() -> IgrisConfig {
        let mut config = IgrisConfig::default();
        config.auth.enabled = true;
        config.auth.api_key = "secret".to_string();
        config
    }

    #[test]
    fn rejects_disabled_auth_by_default() {
        let mut config = base_config();
        config.auth.enabled = false;
        let policy = RuntimeSecurityPolicy {
            allow_insecure_dev_mode: false,
            runtime_submission_api_enabled: true,
        };

        let err = validate_runtime_security_config(&config, policy, true).unwrap_err();
        assert!(err.to_string().contains("auth.enabled=false"));
    }

    #[test]
    fn rejects_missing_overture_key_when_runtime_submission_enabled() {
        let config = base_config();
        let policy = RuntimeSecurityPolicy {
            allow_insecure_dev_mode: false,
            runtime_submission_api_enabled: true,
        };

        let err = validate_runtime_security_config(&config, policy, false).unwrap_err();
        assert!(err.to_string().contains("IGRIS_OVERTURE_PUBLIC_KEY"));
    }

    #[test]
    fn allows_missing_overture_key_when_runtime_submission_disabled() {
        let config = base_config();
        let policy = RuntimeSecurityPolicy {
            allow_insecure_dev_mode: false,
            runtime_submission_api_enabled: false,
        };

        assert!(validate_runtime_security_config(&config, policy, false).is_ok());
    }

    #[test]
    fn allows_explicit_insecure_dev_mode() {
        let mut config = base_config();
        config.auth.enabled = false;
        config.auth.api_key.clear();
        let policy = RuntimeSecurityPolicy {
            allow_insecure_dev_mode: true,
            runtime_submission_api_enabled: true,
        };

        assert!(validate_runtime_security_config(&config, policy, false).is_ok());
    }
}
