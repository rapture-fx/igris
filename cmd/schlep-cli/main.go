// Schlep CLI - Command-line interface for tenant and vault management (Phase 14)
package main

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/Schlep-engine/igris-inertial/igris-overture/emergency"
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
	rootCmd.AddCommand(emergencyCmd)
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
// EMERGENCY COMMANDS
// ============================================================================

var emergencyCmd = &cobra.Command{
	Use:   "emergency",
	Short: "Manage emergency policy hotfixes",
	Long: `Push signed policy updates during prolonged control plane outages.

These commands allow you to update routing policies from a phone during
month-long outages using signed policy blobs served from static endpoints.`,
}

var emergencyPushCmd = &cobra.Command{
	Use:   "push --file <policy.json> --private-key <key>",
	Short: "Push emergency policy update",
	Long: `Push a signed emergency policy update to the control plane.

The policy will be signed with Ed25519 and can be served from static
endpoints even when the main control plane is completely dead.`,
	Run: func(cmd *cobra.Command, args []string) {
		file, _ := cmd.Flags().GetString("file")
		privateKeyBase64, _ := cmd.Flags().GetString("private-key")
		version, _ := cmd.Flags().GetUint64("version")
		expiresHours, _ := cmd.Flags().GetInt("expires")
		issuer, _ := cmd.Flags().GetString("issuer")
		reason, _ := cmd.Flags().GetString("reason")
		adminKey, _ := cmd.Flags().GetString("admin-key")

		// Validate inputs
		if file == "" {
			fmt.Fprintf(os.Stderr, "Error: --file is required\n")
			os.Exit(1)
		}
		if privateKeyBase64 == "" {
			fmt.Fprintf(os.Stderr, "Error: --private-key is required\n")
			os.Exit(1)
		}
		if adminKey == "" {
			adminKey = os.Getenv("SCHLEP_EMERGENCY_ADMIN_KEY")
			if adminKey == "" {
				fmt.Fprintf(os.Stderr, "Error: --admin-key is required (or set SCHLEP_EMERGENCY_ADMIN_KEY)\n")
				os.Exit(1)
			}
		}

		// Read policy file
		policyBytes, err := ioutil.ReadFile(file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to read policy file: %v\n", err)
			os.Exit(1)
		}

		// Decode private key
		privateKeyBytes, err := base64.StdEncoding.DecodeString(privateKeyBase64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid private key encoding: %v\n", err)
			os.Exit(1)
		}

		if len(privateKeyBytes) != ed25519.PrivateKeySize {
			fmt.Fprintf(os.Stderr, "Private key must be %d bytes, got %d\n", ed25519.PrivateKeySize, len(privateKeyBytes))
			os.Exit(1)
		}

		privateKey := ed25519.PrivateKey(privateKeyBytes)

		// Calculate expiration
		expiresAt := time.Now().Add(time.Duration(expiresHours) * time.Hour).UnixMilli()

		// Sign policy
		policy, err := emergency.SignPolicy(
			string(policyBytes),
			privateKey,
			version,
			expiresAt,
			issuer,
			reason,
		)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to sign policy: %v\n", err)
			os.Exit(1)
		}

		// Push to control plane
		url := apiURL + "/v1/emergency/policy"
		jsonData, err := json.Marshal(policy)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to marshal policy: %v\n", err)
			os.Exit(1)
		}

		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create request: %v\n", err)
			os.Exit(1)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Admin-Key", adminKey)

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to push policy: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			fmt.Fprintf(os.Stderr, "Failed to push policy (HTTP %d): %s\n", resp.StatusCode, string(body))
			os.Exit(1)
		}

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)

		fmt.Println("✓ Emergency policy pushed successfully")
		printJSON(result)
		fmt.Printf("\nPolicy version: %d\n", policy.Version)
		fmt.Printf("Expires at: %s\n", time.UnixMilli(policy.ExpiresAt).Format(time.RFC3339))
	},
}

var emergencyGenerateKeysCmd = &cobra.Command{
	Use:   "generate-keys",
	Short: "Generate Ed25519 key pair for signing policies",
	Run: func(cmd *cobra.Command, args []string) {
		publicKeyBase64, privateKeyBase64, err := emergency.GenerateKeyPair()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to generate keys: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("✓ Ed25519 key pair generated")
		fmt.Println("\nPublic Key (share with control plane):")
		fmt.Println(publicKeyBase64)
		fmt.Println("\nPrivate Key (KEEP SECRET - use for signing):")
		fmt.Println(privateKeyBase64)
		fmt.Println("\n⚠️  IMPORTANT: Store the private key securely!")
		fmt.Println("   Anyone with the private key can push emergency policies.")
	},
}

var emergencyShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show current emergency policy",
	Run: func(cmd *cobra.Command, args []string) {
		url := apiURL + "/v1/emergency/policy"

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create request: %v\n", err)
			os.Exit(1)
		}

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to fetch policy: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusNoContent {
			fmt.Println("No emergency policy currently active")
			return
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			fmt.Fprintf(os.Stderr, "Failed to fetch policy (HTTP %d): %s\n", resp.StatusCode, string(body))
			os.Exit(1)
		}

		var policy emergency.EmergencyPolicy
		if err := json.NewDecoder(resp.Body).Decode(&policy); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse policy: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("Current Emergency Policy:")
		printJSON(policy)
	},
}

func init() {
	emergencyPushCmd.Flags().String("file", "", "Path to policy JSON file (required)")
	emergencyPushCmd.Flags().String("private-key", "", "Ed25519 private key (base64) (required)")
	emergencyPushCmd.Flags().Uint64("version", 1, "Policy version (must be higher than current)")
	emergencyPushCmd.Flags().Int("expires", 168, "Expiration time in hours (default: 7 days)")
	emergencyPushCmd.Flags().String("issuer", "admin", "Issuer name (for audit trail)")
	emergencyPushCmd.Flags().String("reason", "", "Reason for emergency update (for audit trail)")
	emergencyPushCmd.Flags().String("admin-key", "", "Admin key (or set SCHLEP_EMERGENCY_ADMIN_KEY)")

	emergencyCmd.AddCommand(emergencyPushCmd)
	emergencyCmd.AddCommand(emergencyGenerateKeysCmd)
	emergencyCmd.AddCommand(emergencyShowCmd)
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
