// Package migrations exposes repository-controlled Overture migration assets.
package migrations

import "embed"

// Files contains the immutable historical migration files. Callers select
// explicit names; application startup must never iterate and apply this set.
//
//go:embed *.sql
var Files embed.FS
