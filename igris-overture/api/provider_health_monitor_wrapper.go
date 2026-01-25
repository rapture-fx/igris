// Package api provides wrappers for scheduler components
package api

import (
	"database/sql"

	"github.com/Igris-inertial/system/igris-overture/scheduler"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// NewProviderHealthMonitor creates a new provider health monitor
func NewProviderHealthMonitor(db *sql.DB, keyVault *security.KeyVault, config *scheduler.ProviderHealthMonitorConfig) *scheduler.ProviderHealthMonitor {
	return scheduler.NewProviderHealthMonitor(db, keyVault, config)
}
