package verifier

import (
	"os/exec"
	"strings"
	"testing"
)

// TestImplementationIndependence mechanically proves the standalone verifier
// build graph contains no maintained production verification package, no
// Python bridge, no network stack, no subprocess machinery, and no database
// driver. It inspects the non-test build dependencies of every package in
// this module; the os/exec import in this test file is test-only and does not
// enter that graph.
func TestImplementationIndependence(t *testing.T) {
	out, err := exec.Command("go", "list", "-deps",
		"-f", "{{if not .Standard}}{{.ImportPath}}{{end}}",
		"./...").CombinedOutput()
	if err != nil {
		t.Fatalf("go list -deps failed: %v\n%s", err, out)
	}
	const modulePrefix = "github.com/Igris-inertial/system/conformance/go-verifier"
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		pkg := strings.TrimSpace(line)
		if pkg == "" {
			continue
		}
		if !strings.HasPrefix(pkg, modulePrefix) {
			t.Errorf("non-standard-library dependency outside this module: %s", pkg)
		}
	}

	// Redundant belt-and-braces scan of the full graph (standard library
	// included) for prohibited capabilities.
	full, err := exec.Command("go", "list", "-deps", "./...").CombinedOutput()
	if err != nil {
		t.Fatalf("go list -deps failed: %v\n%s", err, full)
	}
	prohibited := []string{
		"github.com/Igris-inertial/system/igris-overture",
		"github.com/Igris-inertial/system/rust-core",
		"net",      // exact package: no sockets
		"net/http", // no HTTP client/server
		"os/exec",  // no subprocesses (no Python bridge)
		"database/sql",
	}
	graph := map[string]struct{}{}
	for _, line := range strings.Split(strings.TrimSpace(string(full)), "\n") {
		graph[strings.TrimSpace(line)] = struct{}{}
	}
	for _, pkg := range prohibited {
		if _, present := graph[pkg]; present {
			t.Errorf("prohibited package in the build graph: %s", pkg)
		}
	}
	for pkg := range graph {
		if strings.HasPrefix(pkg, "github.com/Igris-inertial/system/igris-overture") {
			t.Errorf("maintained production package in the build graph: %s", pkg)
		}
	}
}
