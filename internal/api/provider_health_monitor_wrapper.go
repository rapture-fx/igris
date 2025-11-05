// Package api provides wrappers for scheduler components
package api

import (
	"database/sql"

	"github.com/schlep-engine/schlep-engine/internal/scheduler"
	"github.com/schlep-engine/schlep-engine/internal/security"
)

// NewProviderHealthMonitor creates a new provider health monitor
func NewProviderHealthMonitor(db *sql.DB, keyVault *security.KeyVault, config *scheduler.ProviderHealthMonitorConfig) *scheduler.ProviderHealthMonitor {
	return scheduler.NewProviderHealthMonitor(db, keyVault, config)
}
