// Package api provides wrappers for scheduler components
package api

import (
	"database/sql"

	"github.com/Igris-inertial/system/igris-overture/scheduler"
)

// NewTelemetryAggregator creates a new telemetry aggregator
func NewTelemetryAggregator(db *sql.DB, config *scheduler.TelemetryAggregatorConfig) *scheduler.TelemetryAggregator {
	return scheduler.NewTelemetryAggregator(db, config)
}
