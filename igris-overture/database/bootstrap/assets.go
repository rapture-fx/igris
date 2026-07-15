// Package bootstrap implements the explicit, fail-closed Connected database
// bootstrap path. It is intentionally not imported by application startup.
package bootstrap

import (
	_ "embed"

	"github.com/Igris-inertial/system/igris-overture/database/schemastate"
)

const (
	Component       = schemastate.Component
	BaselineVersion = schemastate.BaselineVersion
	// BaselineSHA256 is verified before any SQL is executed.
	BaselineSHA256 = schemastate.BaselineSHA256
	// Expected schema digests are computed from schema_manifest.sql.
	ExpectedV066SchemaSHA256 = schemastate.ExpectedV066SchemaSHA256
	ExpectedV069SchemaSHA256 = schemastate.ExpectedV069SchemaSHA256
)

//go:embed connected_actions_v066.sql
var BaselineSQL []byte

var SchemaManifestSQL = schemastate.ManifestSQL
