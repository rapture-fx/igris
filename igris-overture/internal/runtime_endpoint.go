package internal

import (
	"errors"
	"net/url"
	"strings"
)

var ErrInvalidRuntimeEndpoint = errors.New("invalid runtime endpoint")

// NormalizeHTTPRuntimeEndpoint validates and canonicalizes a runtime base URL.
// The current Overture runtime dispatch model posts directly to this HTTP(S)
// endpoint, so empty, opaque, credential-bearing, or non-HTTP URLs are not
// routable.
func NormalizeHTTPRuntimeEndpoint(raw string) (string, error) {
	endpoint := strings.TrimSpace(raw)
	if endpoint == "" {
		return "", ErrInvalidRuntimeEndpoint
	}
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", ErrInvalidRuntimeEndpoint
	}
	u.Scheme = strings.ToLower(u.Scheme)
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", ErrInvalidRuntimeEndpoint
	}
	if u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "", ErrInvalidRuntimeEndpoint
	}
	u.Path = strings.TrimRight(u.Path, "/")
	return u.String(), nil
}

func IsRoutableHTTPRuntimeEndpoint(raw string) bool {
	_, err := NormalizeHTTPRuntimeEndpoint(raw)
	return err == nil
}
