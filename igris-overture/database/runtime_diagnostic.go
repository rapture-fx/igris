package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/database/roles"
)

func runRuntimePrivilegeDiagnostic(sqlDB *sql.DB, failFast bool, logger *log.Logger) error {
	if sqlDB == nil {
		return fmt.Errorf("privilege diagnostic requires an open database")
	}
	migrationOwner := os.Getenv("IGRIS_DB_ROLE_MIGRATION_OWNER")
	if migrationOwner == "" {
		migrationOwner = roles.DefaultMigrationOwner
	}
	d, err := roles.DiagnoseRuntimeWithTimeout(sqlDB, migrationOwner, 5*time.Second)
	if err != nil {
		return fmt.Errorf("runtime privilege diagnostic: %w", err)
	}
	var b strings.Builder
	roles.WriteRuntimeDiagnostic(&b, d)
	for _, line := range strings.Split(strings.TrimSpace(b.String()), "\n") {
		if line == "" {
			continue
		}
		logger.Println(line)
	}
	if !d.OK && failFast {
		return fmt.Errorf("unsafe database privilege configuration for runtime: %s", strings.Join(d.Issues, "; "))
	}
	return nil
}
