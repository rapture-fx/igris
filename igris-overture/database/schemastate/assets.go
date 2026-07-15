// Package schemastate provides read-only inspection of the supported
// actions-first Connected schema. It does not embed migration SQL and cannot
// execute DDL.
package schemastate

import _ "embed"

const (
	Component       = "connected-actions"
	BaselineVersion = "v066"

	BaselineSHA256           = "7b657178b48c9d1bc92daf55f73c85540df1c84213d1366af09e60b49d727097"
	ExpectedV066SchemaSHA256 = "5ff504aec3d36e5a0f4ff2efc708158bd18e352e04d38171d58f6aa3c90f6aec"
	ExpectedV069SchemaSHA256 = "034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4"
)

// ManifestSQL inspects catalog state only. It is deliberately separate from
// the migration-assets package so runtime diagnostics cannot reach migration
// execution through their dependency graph.
//
//go:embed schema_manifest.sql
var ManifestSQL string
