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
	databaseURL := flag.String("database-url", "", "PostgreSQL URL (prefer DATABASE_URL_MIGRATION / admin capable connection)")
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

	if _, err := roles.StagingPreflight(ctx, db, roles.NamesFromEnv(), os.Stdout); err != nil {
		fatal("staging preflight refused: %v", err)
	}
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
