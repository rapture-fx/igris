// Schlep CLI - Command-line interface for tenant and vault management (Phase 14)
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/spf13/cobra"
)

var (
	// Global flags
	apiURL   string
	apiToken string
	apiKey   string

	// Root command
	rootCmd = &cobra.Command{
		Use:   "schlep-cli",
		Short: "Schlep-engine CLI for tenant and vault management",
		Long: `Command-line interface for managing tenants, BYOK keys, and policies
in Schlep-engine multi-tenant deployment (Phase 14).`,
	}
)

func init() {
	// Global flags
	rootCmd.PersistentFlags().StringVar(&apiURL, "api-url", getEnv("SCHLEP_API_URL", "http://localhost:8080"), "Schlep API base URL")
	rootCmd.PersistentFlags().StringVar(&apiToken, "token", getEnv("SCHLEP_TOKEN", ""), "JWT authentication token")
	rootCmd.PersistentFlags().StringVar(&apiKey, "api-key", getEnv("SCHLEP_API_KEY", ""), "API key for authentication")

	// Add command groups
	rootCmd.AddCommand(tenantCmd)
	rootCmd.AddCommand(vaultCmd)
	rootCmd.AddCommand(policyCmd)
	rootCmd.AddCommand(usageCmd)
	rootCmd.AddCommand(authCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// ============================================================================
// TENANT COMMANDS
// ============================================================================

var tenantCmd = &cobra.Command{
	Use:   "tenant",
	Short: "Manage tenants",
	Long:  "Create, list, and manage tenant accounts",
}

var tenantCreateCmd = &cobra.Command{
	Use:   "create <tenant-id> <name> <email>",
	Short: "Create a new tenant",
	Args:  cobra.ExactArgs(3),
	Run: func(cmd *cobra.Command, args []string) {
		tenantID := args[0]
		name := args[1]
		email := args[2]

		payload := map[string]string{
			"tenant_id":   tenantID,
			"tenant_name": name,
			"email":       email,
		}

		resp, err := makeRequest("POST", "/v1/tenants", payload)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create tenant: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("✓ Tenant created successfully")
		printJSON(resp)
		fmt.Println("\n⚠️  IMPORTANT: Save the api_key above - it won't be shown again!")
	},
}

var tenantListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all tenants",
	Run: func(cmd *cobra.Command, args []string) {
		status, _ := cmd.Flags().GetString("status")
		limit, _ := cmd.Flags().GetInt("limit")

		url := fmt.Sprintf("/v1/tenants?status=%s&limit=%d", status, limit)
		resp, err := makeRequest("GET", url, nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to list tenants: %v\n", err)
			os.Exit(1)
		}

		printJSON(resp)
	},
}

var tenantGetCmd = &cobra.Command{
	Use:   "get <tenant-id>",
	Short: "Get tenant details",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		tenantID := args[0]
		resp, err := makeRequest("GET", "/v1/tenants/"+tenantID, nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to get tenant: %v\n", err)
			os.Exit(1)
		}

		printJSON(resp)
	},
}

var tenantSuspendCmd = &cobra.Command{
	Use:   "suspend <tenant-id>",
	Short: "Suspend a tenant",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		tenantID := args[0]
		resp, err := makeRequest("POST", "/v1/tenants/"+tenantID+"/suspend", nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to suspend tenant: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("✓ Tenant suspended")
		printJSON(resp)
	},
}

func init() {
	tenantListCmd.Flags().String("status", "active", "Filter by status (active, suspended, all)")
	tenantListCmd.Flags().Int("limit", 50, "Number of results")

	tenantCmd.AddCommand(tenantCreateCmd)
	tenantCmd.AddCommand(tenantListCmd)
	tenantCmd.AddCommand(tenantGetCmd)
	tenantCmd.AddCommand(tenantSuspendCmd)
}

// ============================================================================
// VAULT COMMANDS
// ============================================================================

var vaultCmd = &cobra.Command{
	Use:   "vault",
	Short: "Manage BYOK vault keys",
	Long:  "Store, list, and manage encrypted API keys in the BYOK vault",
}

var vaultUploadCmd = &cobra.Command{
	Use:   "upload <provider> <api-key>",
	Short: "Upload an API key to the vault",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		provider := args[0]
		key := args[1]
		keyName, _ := cmd.Flags().GetString("name")

		payload := map[string]string{
			"provider": provider,
			"key_name": keyName,
			"api_key":  key,
		}

		resp, err := makeRequest("POST", "/v1/vault/keys", payload)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to upload key: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("✓ %s API key uploaded successfully\n", provider)
		printJSON(resp)
	},
}

var vaultListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all vault keys (masked)",
	Run: func(cmd *cobra.Command, args []string) {
		provider, _ := cmd.Flags().GetString("provider")
		url := "/v1/vault/keys"
		if provider != "" {
			url += "?provider=" + provider
		}

		resp, err := makeRequest("GET", url, nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to list keys: %v\n", err)
			os.Exit(1)
		}

		printJSON(resp)
	},
}

var vaultDeleteCmd = &cobra.Command{
	Use:   "delete <provider>",
	Short: "Delete a vault key",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		provider := args[0]
		resp, err := makeRequest("DELETE", "/v1/vault/keys/"+provider, nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to delete key: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("✓ %s API key deleted\n", provider)
		printJSON(resp)
	},
}

func init() {
	vaultUploadCmd.Flags().String("name", "default", "Key name")
	vaultListCmd.Flags().String("provider", "", "Filter by provider")

	vaultCmd.AddCommand(vaultUploadCmd)
	vaultCmd.AddCommand(vaultListCmd)
	vaultCmd.AddCommand(vaultDeleteCmd)
}

// ============================================================================
// POLICY COMMANDS
// ============================================================================

var policyCmd = &cobra.Command{
	Use:   "policy",
	Short: "Manage safety policies",
	Long:  "View and update tenant safety policies",
}

var policyGetCmd = &cobra.Command{
	Use:   "get",
	Short: "Get current policy",
	Run: func(cmd *cobra.Command, args []string) {
		resp, err := makeRequest("GET", "/v1/policy", nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to get policy: %v\n", err)
			os.Exit(1)
		}

		printJSON(resp)
	},
}

var policySetCmd = &cobra.Command{
	Use:   "set",
	Short: "Update policy settings",
	Run: func(cmd *cobra.Command, args []string) {
		payload := make(map[string]interface{})

		if cmd.Flags().Changed("budget") {
			budget, _ := cmd.Flags().GetFloat64("budget")
			payload["max_monthly_cost_usd"] = budget
		}
		if cmd.Flags().Changed("tokens") {
			tokens, _ := cmd.Flags().GetInt("tokens")
			payload["max_tokens_per_request"] = tokens
		}
		if cmd.Flags().Changed("webhook") {
			webhook, _ := cmd.Flags().GetString("webhook")
			payload["alert_webhook_url"] = webhook
		}

		if len(payload) == 0 {
			fmt.Println("No policy changes specified")
			return
		}

		resp, err := makeRequest("PUT", "/v1/policy", payload)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to update policy: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("✓ Policy updated")
		printJSON(resp)
	},
}

func init() {
	policySetCmd.Flags().Float64("budget", 0, "Max monthly cost in USD")
	policySetCmd.Flags().Int("tokens", 0, "Max tokens per request")
	policySetCmd.Flags().String("webhook", "", "Alert webhook URL")

	policyCmd.AddCommand(policyGetCmd)
	policyCmd.AddCommand(policySetCmd)
}

// ============================================================================
// USAGE COMMANDS
// ============================================================================

var usageCmd = &cobra.Command{
	Use:   "usage",
	Short: "View usage statistics",
	Long:  "View current and historical usage statistics",
}

var usageShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show current month usage",
	Run: func(cmd *cobra.Command, args []string) {
		resp, err := makeRequest("GET", "/v1/usage", nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to get usage: %v\n", err)
			os.Exit(1)
		}

		printJSON(resp)
	},
}

var usageHistoryCmd = &cobra.Command{
	Use:   "history",
	Short: "Show historical usage",
	Run: func(cmd *cobra.Command, args []string) {
		months, _ := cmd.Flags().GetInt("months")
		url := fmt.Sprintf("/v1/usage/history?months=%d", months)

		resp, err := makeRequest("GET", url, nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to get history: %v\n", err)
			os.Exit(1)
		}

		printJSON(resp)
	},
}

func init() {
	usageHistoryCmd.Flags().Int("months", 6, "Number of months")

	usageCmd.AddCommand(usageShowCmd)
	usageCmd.AddCommand(usageHistoryCmd)
}

// ============================================================================
// AUTH COMMANDS
// ============================================================================

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authentication commands",
	Long:  "Login and manage authentication tokens",
}

var authLoginCmd = &cobra.Command{
	Use:   "login <api-key>",
	Short: "Login with API key to get JWT token",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]

		payload := map[string]string{
			"api_key": key,
		}

		resp, err := makeRequestNoAuth("POST", "/v1/auth/login", payload)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Login failed: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("✓ Login successful")
		printJSON(resp)
		fmt.Println("\nSave the token above and use it with:")
		fmt.Println("  export SCHLEP_TOKEN=<token>")
		fmt.Println("  Or use: schlep-cli --token <token> ...")
	},
}

func init() {
	authCmd.AddCommand(authLoginCmd)
}

// ============================================================================
// HTTP CLIENT HELPERS
// ============================================================================

func makeRequest(method, path string, payload interface{}) (map[string]interface{}, error) {
	url := apiURL + path

	var body io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")

	// Add authentication
	if apiToken != "" {
		req.Header.Set("Authorization", "Bearer "+apiToken)
	} else if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	} else {
		return nil, fmt.Errorf("no authentication provided (use --token or --api-key)")
	}

	// Make request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Parse response
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Check for errors
	if resp.StatusCode >= 400 {
		if errMsg, ok := result["error"].(string); ok {
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, errMsg)
		}
		return nil, fmt.Errorf("API error: %d", resp.StatusCode)
	}

	return result, nil
}

func makeRequestNoAuth(method, path string, payload interface{}) (map[string]interface{}, error) {
	url := apiURL + path

	var body io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		if errMsg, ok := result["error"].(string); ok {
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, errMsg)
		}
		return nil, fmt.Errorf("API error: %d", resp.StatusCode)
	}

	return result, nil
}

func printJSON(data interface{}) {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to format JSON: %v\n", err)
		return
	}
	fmt.Println(string(jsonData))
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
