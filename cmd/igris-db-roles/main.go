package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/Igris-inertial/system/igris-overture/database/roles"
	_ "github.com/lib/pq"
)

func main() {
	mode := flag.String("mode", string(roles.ModePreflight), "preflight or apply")
	databaseURL := flag.String("database-url", "", "PostgreSQL URL for a migration-owner capable connection (prefer DATABASE_URL_MIGRATION)")
	timeout := flag.Duration("timeout", 2*time.Minute, "overall operation timeout")
	flag.Parse()

	url := *databaseURL
	if url == "" {
		for _, name := range []string{"DATABASE_URL_MIGRATION", "DATABASE_URL_DIRECT", "DATABASE_URL"} {
			if value := os.Getenv(name); value != "" {
				url = value
				break
			}
		}
	}
	if url == "" {
		fatal("database URL is required via --database-url, DATABASE_URL_MIGRATION, DATABASE_URL_DIRECT, or DATABASE_URL")
	}

	// Never print full DSN; only a redacted form on verbose failures.
	_ = roles.RedactedDSN(url)

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

	runner, err := roles.NewRunner(roles.NamesFromEnv())
	if err != nil {
		fatal("invalid role configuration: %v", err)
	}
	if _, err := runner.Run(ctx, db, roles.Mode(*mode), os.Stdout); err != nil {
		fatal("role provisioning refused: %v", err)
	}
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
