package semantic

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// PostgresClassificationDB implements ClassificationDB using PostgreSQL
type PostgresClassificationDB struct {
	db *sql.DB
}

// NewPostgresClassificationDB creates a new PostgreSQL-backed classification database
func NewPostgresClassificationDB(db *sql.DB) *PostgresClassificationDB {
	return &PostgresClassificationDB{
		db: db,
	}
}

// Save persists a classification result to the database
func (p *PostgresClassificationDB) Save(ctx context.Context, promptHash, promptPreview, class string, confidence float64, latencyMs int64, cacheHit bool) error {
	query := `
		INSERT INTO semantic_classifications (
			prompt_hash, prompt_preview, semantic_class, confidence_score,
			classifier_version, classification_latency_ms, cache_hit
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (prompt_hash) DO UPDATE SET
			last_accessed_at = CURRENT_TIMESTAMP,
			access_count = semantic_classifications.access_count + 1
	`

	_, err := p.db.ExecContext(ctx, query,
		promptHash,
		promptPreview,
		class,
		confidence,
		"v1.0", // classifier version
		latencyMs,
		cacheHit,
	)

	if err != nil {
		return fmt.Errorf("failed to save classification: %w", err)
	}

	return nil
}

// GetStats retrieves statistics for a semantic class
func (p *PostgresClassificationDB) GetStats(ctx context.Context, class string) (int, float64, error) {
	query := `
		SELECT
			COUNT(*) as total_classifications,
			COALESCE(AVG(confidence_score), 0) as avg_confidence
		FROM semantic_classifications
		WHERE semantic_class = $1
	`

	var total int
	var avgConf float64

	err := p.db.QueryRowContext(ctx, query, class).Scan(&total, &avgConf)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get stats: %w", err)
	}

	return total, avgConf, nil
}

// GetByHash retrieves a classification by prompt hash
func (p *PostgresClassificationDB) GetByHash(ctx context.Context, promptHash string) (*StoredClassification, error) {
	query := `
		SELECT
			id, prompt_hash, prompt_preview, semantic_class, confidence_score,
			classifier_version, classification_latency_ms, cache_hit,
			created_at, last_accessed_at, access_count
		FROM semantic_classifications
		WHERE prompt_hash = $1
	`

	var sc StoredClassification
	err := p.db.QueryRowContext(ctx, query, promptHash).Scan(
		&sc.ID,
		&sc.PromptHash,
		&sc.PromptPreview,
		&sc.SemanticClass,
		&sc.ConfidenceScore,
		&sc.ClassifierVersion,
		&sc.ClassificationLatencyMs,
		&sc.CacheHit,
		&sc.CreatedAt,
		&sc.LastAccessedAt,
		&sc.AccessCount,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get classification: %w", err)
	}

	return &sc, nil
}

// GetRecentByClass retrieves recent classifications for a specific class
func (p *PostgresClassificationDB) GetRecentByClass(ctx context.Context, class string, limit int) ([]*StoredClassification, error) {
	query := `
		SELECT
			id, prompt_hash, prompt_preview, semantic_class, confidence_score,
			classifier_version, classification_latency_ms, cache_hit,
			created_at, last_accessed_at, access_count
		FROM semantic_classifications
		WHERE semantic_class = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := p.db.QueryContext(ctx, query, class, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query classifications: %w", err)
	}
	defer rows.Close()

	var results []*StoredClassification
	for rows.Next() {
		var sc StoredClassification
		if err := rows.Scan(
			&sc.ID,
			&sc.PromptHash,
			&sc.PromptPreview,
			&sc.SemanticClass,
			&sc.ConfidenceScore,
			&sc.ClassifierVersion,
			&sc.ClassificationLatencyMs,
			&sc.CacheHit,
			&sc.CreatedAt,
			&sc.LastAccessedAt,
			&sc.AccessCount,
		); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		results = append(results, &sc)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return results, nil
}

// CleanupOld removes old classifications with low access count
func (p *PostgresClassificationDB) CleanupOld(ctx context.Context, daysToKeep int, minAccessCount int) (int, error) {
	query := `
		DELETE FROM semantic_classifications
		WHERE created_at < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
		  AND access_count < $2
	`

	result, err := p.db.ExecContext(ctx, query, daysToKeep, minAccessCount)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old classifications: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return int(rowsAffected), nil
}

// StoredClassification represents a classification stored in the database
type StoredClassification struct {
	ID                       string
	PromptHash               string
	PromptPreview            string
	SemanticClass            string
	ConfidenceScore          float64
	ClassifierVersion        string
	ClassificationLatencyMs  int64
	CacheHit                 bool
	CreatedAt                time.Time
	LastAccessedAt           time.Time
	AccessCount              int
}

// NullDB is a no-op database implementation for testing
type NullDB struct{}

// NewNullDB creates a new null database
func NewNullDB() *NullDB {
	return &NullDB{}
}

// Save is a no-op
func (n *NullDB) Save(ctx context.Context, promptHash, promptPreview, class string, confidence float64, latencyMs int64, cacheHit bool) error {
	return nil
}

// GetStats returns zero values
func (n *NullDB) GetStats(ctx context.Context, class string) (int, float64, error) {
	return 0, 0.0, nil
}
