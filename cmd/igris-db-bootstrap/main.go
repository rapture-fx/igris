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
	databaseURL := flag.String("database-url", "", "PostgreSQL URL (prefer DATABASE_URL_DIRECT environment variable)")
	timeout := flag.Duration("timeout", 5*time.Minute, "overall operation timeout")
	flag.Parse()

	url := *databaseURL
	if url == "" {
		for _, name := range []string{"DATABASE_URL_DIRECT", "DATABASE_URL", "POSTGRES_URL"} {
			if value := os.Getenv(name); value != "" {
				url = value
				break
			}
		}
	}
	if url == "" {
		fatal("database URL is required via --database-url, DATABASE_URL_DIRECT, DATABASE_URL, or POSTGRES_URL")
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
	runner, err := bootstrap.NewRunner()
	if err != nil {
		fatal("load bootstrap artifacts: %v", err)
	}
	if _, err := runner.Run(ctx, db, bootstrap.Mode(*mode), os.Stdout); err != nil {
		fatal("bootstrap refused: %v", err)
	}
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
