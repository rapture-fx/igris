package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/Igris-inertial/system/igris-overture/database/bootstrap"
	_ "github.com/lib/pq"
)

func main() {
	mode := flag.String("mode", string(bootstrap.ModePreflight), "preflight, apply, or adopt-v066")
	databaseURL := flag.String("database-url", "", "explicit PostgreSQL migration-owner URL (or set DATABASE_URL_MIGRATION)")
	migrationOwner := flag.String("migration-owner", os.Getenv("IGRIS_DB_ROLE_MIGRATION_OWNER"), "expected migration-owner role (required for apply/adopt-v066)")
	timeout := flag.Duration("timeout", 5*time.Minute, "overall operation timeout")
	flag.Parse()

	url := *databaseURL
	if url == "" {
		url = os.Getenv("DATABASE_URL_MIGRATION")
	}
	if url == "" {
		fatal("migration database URL is required via --database-url or DATABASE_URL_MIGRATION")
	}

	db, err := sql.Open("postgres", url)
	if err != nil {
		fatal("open PostgreSQL connection: %v", err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		fatal("connect to PostgreSQL: %v", err)
	}
	selectedMode := bootstrap.Mode(*mode)
	var runner *bootstrap.Runner
	if selectedMode == bootstrap.ModePreflight {
		runner, err = bootstrap.NewRunner()
	} else {
		if *migrationOwner == "" {
			fatal("--migration-owner or IGRIS_DB_ROLE_MIGRATION_OWNER is required for %s", selectedMode)
		}
		runner, err = bootstrap.NewOperatorRunner(*migrationOwner)
	}
	if err != nil {
		fatal("load bootstrap artifacts: %v", err)
	}
	if _, err := runner.Run(ctx, db, selectedMode, os.Stdout); err != nil {
		fatal("bootstrap refused: %v", err)
	}
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
