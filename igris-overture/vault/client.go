// Package vault provides a minimal stub for vault integration
// This is a placeholder for Phase 2+ vault integration
package vault

import (
	"fmt"
)

// Client is a stub vault client
type Client struct {
	address string
	enabled bool
}

// NewClient creates a new vault client stub
func NewClient(address string) (*Client, error) {
	if address == "" {
		return &Client{enabled: false}, nil
	}

	return &Client{
		address: address,
		enabled: true,
	}, nil
}

// GetSecret retrieves a secret (stub implementation)
func (c *Client) GetSecret(path string) (map[string]interface{}, error) {
	if !c.enabled {
		return nil, fmt.Errorf("vault client not enabled")
	}
	// Stub: return empty secrets
	return make(map[string]interface{}), nil
}

// PutSecret stores a secret (stub implementation)
func (c *Client) PutSecret(path string, data map[string]interface{}) error {
	if !c.enabled {
		return fmt.Errorf("vault client not enabled")
	}
	// Stub: no-op
	return nil
}

// Close closes the vault client
func (c *Client) Close() error {
	return nil
}

// IsEnabled returns whether vault is enabled
func (c *Client) IsEnabled() bool {
	return c.enabled
}
