package api

import (
	"net"
	"strings"
	"testing"
)

func withLookupIP(t *testing.T, fn func(host string) ([]net.IP, error)) {
	t.Helper()
	prev := lookupIP
	lookupIP = fn
	t.Cleanup(func() { lookupIP = prev })
}

func TestValidateActionTargetURL_LoopbackHTTP(t *testing.T) {
	for _, raw := range []string{
		"http://127.0.0.1:18099/v1/x",
		"http://localhost/hook",
		"http://[::1]/hook",
	} {
		class, err := ValidateActionTargetURL(raw)
		if err != nil {
			t.Fatalf("%s: unexpected error: %v", raw, err)
		}
		if class != ActionTargetURLLoopbackHTTP {
			t.Fatalf("%s: got class %q", raw, class)
		}
	}
}

func TestValidateActionTargetURL_RejectExternalHTTP(t *testing.T) {
	_, err := ValidateActionTargetURLSyntax("http://example.com/hook")
	if err == nil || !strings.Contains(err.Error(), "loopback") {
		t.Fatalf("expected loopback restriction, got %v", err)
	}
}

func TestValidateActionTargetURL_RejectLoopbackHTTPS(t *testing.T) {
	for _, raw := range []string{
		"https://127.0.0.1/hook",
		"https://localhost/hook",
		"https://[::1]/hook",
	} {
		_, err := ValidateActionTargetURLSyntax(raw)
		if err == nil {
			t.Fatalf("expected rejection for %s", raw)
		}
	}
}

func TestValidateActionTargetURL_RejectPrivateLiterals(t *testing.T) {
	cases := []string{
		"https://10.0.0.5/x",
		"https://192.168.1.1/x",
		"https://172.16.0.1/x",
		"https://169.254.169.254/latest/meta-data/",
		"https://100.64.0.1/x",
		"https://[fd12:3456:789a::1]/x",
		"https://[fe80::1]/x",
	}
	for _, raw := range cases {
		_, err := ValidateActionTargetURLSyntax(raw)
		if err == nil {
			t.Fatalf("expected denial for %s", raw)
		}
	}
}

func TestValidateActionTargetURL_RejectEmbeddedCredentials(t *testing.T) {
	_, err := ValidateActionTargetURLSyntax("https://user:pass@example.com/x")
	if err == nil || !strings.Contains(err.Error(), "credential") {
		t.Fatalf("expected credential rejection, got %v", err)
	}
}

func TestValidateActionTargetURL_DNSDeniedAddress(t *testing.T) {
	withLookupIP(t, func(host string) ([]net.IP, error) {
		if host != "evil.example" {
			t.Fatalf("unexpected host %q", host)
		}
		return []net.IP{net.ParseIP("10.1.2.3")}, nil
	})
	_, err := ValidateActionTargetURL("https://evil.example/hook")
	if err == nil || !strings.Contains(err.Error(), "denied address") {
		t.Fatalf("expected denied address, got %v", err)
	}
}

func TestValidateActionTargetURL_DNSRebindingAnyDeniedFailsClosed(t *testing.T) {
	withLookupIP(t, func(host string) ([]net.IP, error) {
		return []net.IP{
			net.ParseIP("1.2.3.4"),
			net.ParseIP("169.254.169.254"),
		}, nil
	})
	_, err := ValidateActionTargetURL("https://mixed.example/hook")
	if err == nil || !strings.Contains(err.Error(), "169.254.169.254") {
		t.Fatalf("expected metadata denial, got %v", err)
	}
}

func TestValidateActionTargetURL_PublicHTTPSAccepted(t *testing.T) {
	withLookupIP(t, func(host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("1.2.3.4")}, nil
	})
	class, err := ValidateActionTargetURL("https://adapter.example.com/v1/deploy")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if class != ActionTargetURLExternalHTTPS {
		t.Fatalf("got class %q", class)
	}
}

func TestValidateActionTargetURLSyntax_AllowsUnresolvedHostname(t *testing.T) {
	// Registration must not require DNS; bind/dispatch re-check.
	class, err := ValidateActionTargetURLSyntax("https://api.example.test/hook")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if class != ActionTargetURLExternalHTTPS {
		t.Fatalf("got class %q", class)
	}
}

func TestValidateActionTargetURL_IPv4MappedIPv6(t *testing.T) {
	withLookupIP(t, func(host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("::ffff:10.0.0.1")}, nil
	})
	_, err := ValidateActionTargetURL("https://mapped.example/hook")
	if err == nil {
		t.Fatal("expected denial for IPv4-mapped private address")
	}
}
