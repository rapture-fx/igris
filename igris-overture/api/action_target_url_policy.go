// Action target URL destination policy for durable webhook bindings.
//
// Two allowed classes:
//   1. Local-dev loopback HTTP (127.0.0.1 / localhost / ::1)
//   2. External HTTPS to public destinations (SSRF-denied ranges rejected)
//
// Registration validates syntax and literal IP class. Bind and dispatch
// re-resolve DNS and validate every returned address (anti-rebinding).
package api

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"
)

// lookupIP is swappable for unit tests. Default prefers the system resolver and
// falls back to public recursive resolvers when the system resolver fails
// (common on misconfigured local networks). Both paths still classify every
// returned address against the SSRF deny list.
var lookupIP = lookupIPDefault

func lookupIPDefault(host string) ([]net.IP, error) {
	ips, err := net.LookupIP(host)
	if err == nil && len(ips) > 0 {
		return ips, nil
	}
	systemErr := err
	for _, dns := range []string{"1.1.1.1:53", "8.8.8.8:53"} {
		ips, err := lookupIPViaResolver(host, dns)
		if err == nil && len(ips) > 0 {
			return ips, nil
		}
	}
	if systemErr != nil {
		return nil, systemErr
	}
	return nil, fmt.Errorf("no addresses for host %q", host)
}

func lookupIPViaResolver(host, dnsAddr string) ([]net.IP, error) {
	resolver := &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
			d := net.Dialer{Timeout: 5 * time.Second}
			return d.DialContext(ctx, network, dnsAddr)
		},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return resolver.LookupIP(ctx, "ip", host)
}

// ActionTargetURLClass identifies which allowed target mode matched.
type ActionTargetURLClass string

const (
	ActionTargetURLLoopbackHTTP  ActionTargetURLClass = "loopback_http"
	ActionTargetURLExternalHTTPS ActionTargetURLClass = "external_https"
)

type parsedActionTargetURL struct {
	raw    string
	parsed *url.URL
	scheme string
	host   string
	class  ActionTargetURLClass
}

// ValidateActionTargetURLSyntax enforces scheme/host class and literal-IP
// policy without DNS. Use at registration time.
func ValidateActionTargetURLSyntax(raw string) (ActionTargetURLClass, error) {
	pt, err := parseActionTargetURL(raw)
	if err != nil {
		return "", err
	}
	if ip := net.ParseIP(pt.host); ip != nil {
		requireLoopback := pt.class == ActionTargetURLLoopbackHTTP
		if err := classifyIP(ip, requireLoopback); err != nil {
			return "", err
		}
	}
	return pt.class, nil
}

// ValidateActionTargetURL enforces full destination policy including DNS
// resolution of all addresses. Use at bind and near dispatch.
func ValidateActionTargetURL(raw string) (ActionTargetURLClass, error) {
	pt, err := parseActionTargetURL(raw)
	if err != nil {
		return "", err
	}
	requireLoopback := pt.class == ActionTargetURLLoopbackHTTP
	if err := validateResolvedAddresses(pt.host, requireLoopback); err != nil {
		return "", err
	}
	return pt.class, nil
}

// IsAllowedActionTargetURL reports whether raw passes full ValidateActionTargetURL.
func IsAllowedActionTargetURL(raw string) bool {
	_, err := ValidateActionTargetURL(raw)
	return err == nil
}

func parseActionTargetURL(raw string) (*parsedActionTargetURL, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, fmt.Errorf("target URL is required")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, fmt.Errorf("invalid target URL: %w", err)
	}
	if parsed.User != nil {
		return nil, fmt.Errorf("target URL must not embed credentials")
	}
	scheme := strings.ToLower(parsed.Scheme)
	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if host == "" {
		return nil, fmt.Errorf("target URL host is required")
	}

	pt := &parsedActionTargetURL{raw: trimmed, parsed: parsed, scheme: scheme, host: host}
	switch scheme {
	case "http":
		if !isLoopbackHostname(host) {
			return nil, fmt.Errorf("http targets are limited to loopback hosts (127.0.0.1, localhost, ::1)")
		}
		pt.class = ActionTargetURLLoopbackHTTP
	case "https":
		if isLoopbackHostname(host) {
			return nil, fmt.Errorf("https targets must not use loopback hosts; use http://127.0.0.1 for local development")
		}
		pt.class = ActionTargetURLExternalHTTPS
	default:
		return nil, fmt.Errorf("unsupported target URL scheme %q", scheme)
	}
	return pt, nil
}

func isLoopbackHostname(host string) bool {
	switch strings.ToLower(strings.TrimSpace(host)) {
	case "127.0.0.1", "localhost", "::1":
		return true
	default:
		return false
	}
}

func validateResolvedAddresses(host string, requireLoopback bool) error {
	if ip := net.ParseIP(host); ip != nil {
		return classifyIP(ip, requireLoopback)
	}

	ips, err := lookupIP(host)
	if err != nil {
		return fmt.Errorf("failed to resolve target host %q: %w", host, err)
	}
	if len(ips) == 0 {
		return fmt.Errorf("target host %q resolved to no addresses", host)
	}
	for _, ip := range ips {
		if err := classifyIP(ip, requireLoopback); err != nil {
			return err
		}
	}
	return nil
}

func classifyIP(ip net.IP, requireLoopback bool) error {
	if ip == nil {
		return fmt.Errorf("invalid IP address")
	}
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}

	if requireLoopback {
		if !ip.IsLoopback() {
			return fmt.Errorf("loopback target resolved to non-loopback address %s", ip)
		}
		return nil
	}

	if isDeniedDestinationIP(ip) {
		return fmt.Errorf("target resolves to denied address %s", ip)
	}
	return nil
}

func isDeniedDestinationIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() || ip.IsUnspecified() || ip.IsInterfaceLocalMulticast() {
		return true
	}

	if v4 := ip.To4(); v4 != nil {
		if v4[0] == 100 && v4[1] >= 64 && v4[1] <= 127 {
			return true
		}
		if v4[0] == 0 {
			return true
		}
		if v4[0] == 192 && v4[1] == 0 && v4[2] == 0 {
			return true
		}
		if v4[0] == 192 && v4[1] == 0 && v4[2] == 2 {
			return true
		}
		if v4[0] == 198 && v4[1] == 51 && v4[2] == 100 {
			return true
		}
		if v4[0] == 203 && v4[1] == 0 && v4[2] == 113 {
			return true
		}
		if v4[0] == 198 && (v4[1] == 18 || v4[1] == 19) {
			return true
		}
	} else if len(ip) == net.IPv6len {
		if (ip[0] & 0xfe) == 0xfc {
			return true
		}
		if ip[0] == 0x20 && ip[1] == 0x01 && ip[2] == 0x0d && ip[3] == 0xb8 {
			return true
		}
	}
	return false
}

// Legacy helper retained for call sites that only need the loopback-HTTP check
// without DNS. Prefer ValidateActionTargetURL for security decisions.
func isLoopbackHTTPURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return false
	}
	if parsed.Scheme != "http" {
		return false
	}
	return isLoopbackHostname(parsed.Hostname())
}
