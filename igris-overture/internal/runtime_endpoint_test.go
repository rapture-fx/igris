package internal

import "testing"

func TestNormalizeHTTPRuntimeEndpoint(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "http", raw: " http://runtime.test/ ", want: "http://runtime.test"},
		{name: "https path", raw: "https://runtime.test/base/", want: "https://runtime.test/base"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := NormalizeHTTPRuntimeEndpoint(tt.raw)
			if err != nil {
				t.Fatalf("NormalizeHTTPRuntimeEndpoint() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("NormalizeHTTPRuntimeEndpoint() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNormalizeHTTPRuntimeEndpointRejectsUnroutableValues(t *testing.T) {
	t.Parallel()

	for _, raw := range []string{
		"",
		"   ",
		"runtime.test",
		"ftp://runtime.test",
		"://bad",
		"http://",
		"http://user:pass@runtime.test",
		"http://runtime.test?token=secret",
		"http://runtime.test/#frag",
	} {
		t.Run(raw, func(t *testing.T) {
			t.Parallel()
			if got, err := NormalizeHTTPRuntimeEndpoint(raw); err == nil {
				t.Fatalf("NormalizeHTTPRuntimeEndpoint(%q) = %q, want error", raw, got)
			}
		})
	}
}
