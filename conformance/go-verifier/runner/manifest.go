// Package runner executes the frozen schema-1 conformance candidate against
// the standalone verifier. It consumes only the committed manifest and suite
// files, performs no network access, writes no suite file, and never invokes
// Python or the maintained production Go verification paths.
package runner

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// SuiteError reports invalid invocation or a corrupt/unsafe suite (CLI exit
// code 2), as opposed to a conformance mismatch.
type SuiteError struct{ Reason string }

func (e *SuiteError) Error() string { return e.Reason }

var vectorIDRe = regexp.MustCompile(`^[a-z0-9][a-zA-Z0-9-]{2,127}$`)

// Manifest is the language-neutral suite manifest.
type Manifest struct {
	Format            string          `json:"format"`
	FormatVersion     string          `json:"format_version"`
	SuiteID           string          `json:"suite_id"`
	SuiteRevision     string          `json:"suite_revision"`
	ProtocolStatus    string          `json:"protocol_status"`
	SourceBaseline    string          `json:"source_baseline_commit"`
	RatificationSHA   string          `json:"ratification_commit"`
	ObjectProfile     string          `json:"object_schema_profile"`
	ResultSchemaID    string          `json:"verification_result_schema_id"`
	Files             []ManifestFile  `json:"files"`
	Vectors           []Vector        `json:"vectors"`
	KnownDivergences  json.RawMessage `json:"known_divergences"`
	suiteRoot         string
	recordedFilePaths map[string]string
}

// ManifestFile is one immutable suite file record.
type ManifestFile struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

// Vector is one declared conformance vector.
type Vector struct {
	ID                     string   `json:"id"`
	Family                 string   `json:"family"`
	ObjectType             string   `json:"object_type"`
	SchemaVersion          string   `json:"schema_version"`
	Capabilities           []string `json:"capabilities"`
	Input                  string   `json:"input"`
	Expected               string   `json:"expected"`
	Canonical              *string  `json:"canonical"`
	Mutation               *string  `json:"mutation"`
	KeyRef                 *string  `json:"key_ref"`
	ExpectedPrimaryIssue   *string  `json:"expected_primary_issue"`
	AllowedSecondaryIssues []string `json:"allowed_secondary_issues"`
	KnownDivergence        *string  `json:"known_divergence"`
	Provenance             string   `json:"provenance"`
}

// safeJoin resolves a manifest-relative path and rejects absolute paths,
// parent traversal, backslashes, and escapes from the suite root.
func (m *Manifest) safeJoin(relative string) (string, error) {
	if relative == "" || strings.HasPrefix(relative, "/") ||
		strings.Contains(relative, "\\") || strings.Contains(relative, "..") {
		return "", &SuiteError{Reason: fmt.Sprintf("unsafe manifest path: %q", relative)}
	}
	joined := filepath.Join(m.suiteRoot, filepath.FromSlash(relative))
	resolved, err := filepath.EvalSymlinks(joined)
	if err != nil {
		return "", &SuiteError{Reason: fmt.Sprintf("manifest file is missing: %s", relative)}
	}
	root, err := filepath.EvalSymlinks(m.suiteRoot)
	if err != nil {
		return "", &SuiteError{Reason: "suite root cannot be resolved"}
	}
	if resolved != root && !strings.HasPrefix(resolved, root+string(filepath.Separator)) {
		return "", &SuiteError{Reason: fmt.Sprintf("manifest path escapes the suite: %s", relative)}
	}
	return resolved, nil
}

// ReadSuiteFile returns the bytes of one manifest-recorded file after
// re-checking its recorded SHA-256.
func (m *Manifest) ReadSuiteFile(relative string) ([]byte, error) {
	recorded, ok := m.recordedFilePaths[relative]
	if !ok {
		return nil, &SuiteError{Reason: fmt.Sprintf("file is not recorded in the manifest: %s", relative)}
	}
	path, err := m.safeJoin(relative)
	if err != nil {
		return nil, err
	}
	data, readErr := os.ReadFile(path)
	if readErr != nil {
		return nil, &SuiteError{Reason: fmt.Sprintf("manifest file is unreadable: %s", relative)}
	}
	digest := sha256.Sum256(data)
	if hex.EncodeToString(digest[:]) != recorded {
		return nil, &SuiteError{Reason: fmt.Sprintf("manifest hash mismatch: %s", relative)}
	}
	return data, nil
}

// LoadManifest reads and fully validates the frozen suite manifest: format
// and status fields, unique stable vector IDs, safe recorded paths, the
// SHA-256 of every referenced file, and registered expected issues.
func LoadManifest(suitePath string, registeredIssues map[string]struct{}) (*Manifest, error) {
	raw, err := os.ReadFile(filepath.Join(suitePath, "manifest.json"))
	if err != nil {
		return nil, &SuiteError{Reason: "manifest.json is unreadable"}
	}
	manifest := &Manifest{suiteRoot: suitePath}
	if err := json.Unmarshal(raw, manifest); err != nil {
		return nil, &SuiteError{Reason: "manifest.json is not valid JSON"}
	}
	if manifest.Format != "igris-test-vector-manifest" || manifest.FormatVersion != "1" {
		return nil, &SuiteError{Reason: "unsupported manifest format"}
	}
	if manifest.ProtocolStatus != "frozen-candidate" {
		return nil, &SuiteError{Reason: "suite must remain a frozen candidate"}
	}
	if manifest.SuiteID == "" || manifest.SuiteRevision == "" {
		return nil, &SuiteError{Reason: "manifest is missing suite identity"}
	}

	seenIDs := make(map[string]struct{}, len(manifest.Vectors))
	for _, vector := range manifest.Vectors {
		if !vectorIDRe.MatchString(vector.ID) {
			return nil, &SuiteError{Reason: fmt.Sprintf("invalid vector ID: %q", vector.ID)}
		}
		if _, duplicate := seenIDs[vector.ID]; duplicate {
			return nil, &SuiteError{Reason: fmt.Sprintf("duplicate vector ID: %s", vector.ID)}
		}
		seenIDs[vector.ID] = struct{}{}
	}

	manifest.recordedFilePaths = make(map[string]string, len(manifest.Files))
	for _, file := range manifest.Files {
		if _, duplicate := manifest.recordedFilePaths[file.Path]; duplicate {
			return nil, &SuiteError{Reason: fmt.Sprintf("duplicated manifest file path: %s", file.Path)}
		}
		manifest.recordedFilePaths[file.Path] = file.SHA256
	}
	for path := range manifest.recordedFilePaths {
		if _, err := manifest.ReadSuiteFile(path); err != nil {
			return nil, err
		}
	}
	for _, vector := range manifest.Vectors {
		for _, required := range []string{vector.Input, vector.Expected} {
			if _, ok := manifest.recordedFilePaths[required]; !ok {
				return nil, &SuiteError{Reason: fmt.Sprintf("%s: unrecorded required file", vector.ID)}
			}
		}
		for _, optional := range []*string{vector.Canonical, vector.Mutation} {
			if optional != nil && *optional != "" {
				if _, ok := manifest.recordedFilePaths[*optional]; !ok {
					return nil, &SuiteError{Reason: fmt.Sprintf("%s: unrecorded optional file", vector.ID)}
				}
			}
		}
		if vector.ExpectedPrimaryIssue != nil {
			if _, ok := registeredIssues[*vector.ExpectedPrimaryIssue]; !ok {
				return nil, &SuiteError{Reason: fmt.Sprintf("%s: unregistered expected issue", vector.ID)}
			}
		}
	}
	return manifest, nil
}

// VectorByID returns the declared vector, if present.
func (m *Manifest) VectorByID(id string) *Vector {
	for i := range m.Vectors {
		if m.Vectors[i].ID == id {
			return &m.Vectors[i]
		}
	}
	return nil
}
