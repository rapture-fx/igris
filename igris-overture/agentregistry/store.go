package agentregistry

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("registered agent not found")

type SQLStore struct {
	DB *sql.DB
}

type scanner interface {
	Scan(dest ...interface{}) error
}

func (s *SQLStore) List(ctx context.Context, tenantID string, includeArchived bool) ([]Agent, error) {
	query := `
		SELECT agent_id, tenant_id, name, display_name, agent_type, template_name, version,
		       description, metadata, created_at, updated_at, archived_at
		FROM registered_agents
		WHERE tenant_id = $1`
	if !includeArchived {
		query += ` AND archived_at IS NULL`
	}
	query += ` ORDER BY updated_at DESC`
	rows, err := s.DB.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	agents := make([]Agent, 0)
	for rows.Next() {
		agent, err := scanAgent(rows)
		if err != nil {
			return nil, err
		}
		agents = append(agents, agent)
	}
	return agents, rows.Err()
}

func (s *SQLStore) Create(ctx context.Context, tenantID string, input CreateInput) (Agent, error) {
	normalized, err := ValidateCreateInput(input)
	if err != nil {
		return Agent{}, err
	}
	metadataBytes, err := json.Marshal(normalized.Metadata)
	if err != nil {
		return Agent{}, fmt.Errorf("marshal metadata: %w", err)
	}
	row := s.DB.QueryRowContext(ctx, `
		INSERT INTO registered_agents (
			tenant_id, name, display_name, agent_type, template_name, version,
			description, metadata, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
		RETURNING agent_id, tenant_id, name, display_name, agent_type, template_name, version,
		          description, metadata, created_at, updated_at, archived_at`,
		tenantID,
		normalized.Name,
		normalized.DisplayName,
		normalized.AgentType,
		normalized.TemplateName,
		normalized.Version,
		normalized.Description,
		metadataBytes,
	)
	return scanAgent(row)
}

func (s *SQLStore) GetByID(ctx context.Context, tenantID, id string) (Agent, error) {
	row := s.DB.QueryRowContext(ctx, `
		SELECT agent_id, tenant_id, name, display_name, agent_type, template_name, version,
		       description, metadata, created_at, updated_at, archived_at
		FROM registered_agents
		WHERE tenant_id = $1 AND agent_id = $2 AND archived_at IS NULL`, tenantID, id)
	return scanAgent(row)
}

func (s *SQLStore) GetByName(ctx context.Context, tenantID, name string) (Agent, error) {
	row := s.DB.QueryRowContext(ctx, `
		SELECT agent_id, tenant_id, name, display_name, agent_type, template_name, version,
		       description, metadata, created_at, updated_at, archived_at
		FROM registered_agents
		WHERE tenant_id = $1 AND name = $2 AND archived_at IS NULL`, tenantID, NormalizeName(name))
	return scanAgent(row)
}

func (s *SQLStore) Update(ctx context.Context, tenantID, id string, input UpdateInput) (Agent, error) {
	current, err := s.GetByID(ctx, tenantID, id)
	if err != nil {
		return Agent{}, err
	}
	normalized, err := ValidateUpdateInput(current, input)
	if err != nil {
		return Agent{}, err
	}

	name := current.Name
	if normalized.Name != nil {
		name = *normalized.Name
	}
	displayName := current.DisplayName
	if normalized.DisplayName != nil {
		displayName = *normalized.DisplayName
	}
	if displayName == "" {
		displayName = name
	}
	agentType := current.AgentType
	if normalized.AgentType != nil {
		agentType = *normalized.AgentType
	}
	templateName := current.TemplateName
	if normalized.TemplateName != nil {
		templateName = *normalized.TemplateName
	}
	version := current.Version
	if normalized.Version != nil {
		version = *normalized.Version
	}
	description := current.Description
	if normalized.Description != nil {
		description = *normalized.Description
	}
	metadata := current.Metadata
	if normalized.MetadataSet {
		metadata = normalized.Metadata
	}
	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return Agent{}, fmt.Errorf("marshal metadata: %w", err)
	}

	row := s.DB.QueryRowContext(ctx, `
		UPDATE registered_agents
		SET name = $3,
		    display_name = $4,
		    agent_type = $5,
		    template_name = $6,
		    version = $7,
		    description = $8,
		    metadata = $9,
		    updated_at = NOW()
		WHERE tenant_id = $1 AND agent_id = $2 AND archived_at IS NULL
		RETURNING agent_id, tenant_id, name, display_name, agent_type, template_name, version,
		          description, metadata, created_at, updated_at, archived_at`,
		tenantID, id, name, displayName, agentType, templateName, version, description, metadataBytes,
	)
	return scanAgent(row)
}

func (s *SQLStore) Archive(ctx context.Context, tenantID, id string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE registered_agents
		SET archived_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND agent_id = $2 AND archived_at IS NULL`, tenantID, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func scanAgent(row scanner) (Agent, error) {
	var agent Agent
	var metadataRaw []byte
	var archivedAt sql.NullTime
	err := row.Scan(
		&agent.AgentID,
		&agent.TenantID,
		&agent.Name,
		&agent.DisplayName,
		&agent.AgentType,
		&agent.TemplateName,
		&agent.Version,
		&agent.Description,
		&metadataRaw,
		&agent.CreatedAt,
		&agent.UpdatedAt,
		&archivedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Agent{}, ErrNotFound
		}
		return Agent{}, err
	}
	if len(metadataRaw) > 0 {
		_ = json.Unmarshal(metadataRaw, &agent.Metadata)
	}
	if agent.Metadata == nil {
		agent.Metadata = map[string]interface{}{}
	}
	agent.Metadata, _ = SanitizeMetadata(agent.Metadata)
	if archivedAt.Valid {
		t := archivedAt.Time
		agent.ArchivedAt = &t
	}
	return agent, nil
}

func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}

func NullUUIDString(id uuid.UUID) interface{} {
	if id == uuid.Nil {
		return nil
	}
	return id.String()
}