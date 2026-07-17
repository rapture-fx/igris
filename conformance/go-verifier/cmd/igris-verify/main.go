// Command igris-verify is the standalone offline Igris schema-1 verifier.
//
// It verifies ActionContract and Evidence artifacts against the frozen
// schema-1 protocol profile and emits exactly one machine-readable
// igris:protocol:verification-result:1 object on stdout. It performs no
// network, database, or environment access and never invokes Python or the
// maintained production verification paths.
//
// Exit codes:
//
//	0  verification completed and a result was emitted (any summary)
//	1  conformance-vector mismatch in vectors mode
//	2  invalid CLI invocation or corrupt vector suite
//	3  requested artifact capability/schema unsupported by this build
//	4  local resource/I/O failure prevented a result from being produced
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/Igris-inertial/system/conformance/go-verifier/runner"
	"github.com/Igris-inertial/system/conformance/go-verifier/verifier"
)

const (
	exitOK          = 0
	exitMismatch    = 1
	exitInvocation  = 2
	exitUnsupported = 3
	exitIO          = 4
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}

func run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		usage(stderr)
		return exitInvocation
	}
	switch args[0] {
	case "artifact":
		return runArtifact(args[1:], stdin, stdout, stderr, "")
	case "verify":
		// verify <input> [flags] is the developer-facing alias: the artifact
		// type is detected structurally and can be overridden with --type.
		return runVerify(args[1:], stdin, stdout, stderr)
	case "vectors":
		return runVectors(args[1:], stdout, stderr)
	case "help", "-h", "--help":
		usage(stdout)
		return exitOK
	default:
		fmt.Fprintf(stderr, "igris-verify: unknown command %q\n", args[0])
		usage(stderr)
		return exitInvocation
	}
}

func usage(w io.Writer) {
	fmt.Fprint(w, `igris-verify — standalone offline Igris schema-1 verifier

Usage:
  igris-verify verify <path|-> [--key <path>] [--type contract|evidence|chain|value]
  igris-verify artifact --type <type> --input <path|-> [--key <path>] [--human]
  igris-verify vectors --suite <dir> [--vector <id>] [--family <name>] [--capability <name>]

verify/artifact emit exactly one igris:protocol:verification-result:1 JSON
object on stdout. --human adds a short explanation on stderr; it never echoes
payload values or key material. '-' reads the artifact from stdin.

vectors runs the frozen schema-1 conformance suite against this verifier only
and emits a machine-readable report on stdout.

The process performs no network, database, or environment access.
`)
}

// runVerify implements the developer-facing alias with structural artifact
// detection. Detection never downgrades: an artifact that matches no supported
// schema-1 shape is dispatched as an evidence/contract candidate by its
// distinguishing fields, and everything else fails closed as an unsupported
// invocation unless --type forces a specific check.
func runVerify(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	var positional []string
	rest := args
	for len(rest) > 0 && !strings.HasPrefix(rest[0], "-") || (len(rest) > 0 && rest[0] == "-") {
		positional = append(positional, rest[0])
		rest = rest[1:]
		if len(positional) == 1 {
			break
		}
	}
	if len(positional) != 1 {
		fmt.Fprintln(stderr, "igris-verify verify: exactly one input path (or -) is required")
		return exitInvocation
	}
	return runArtifact(append([]string{"--input", positional[0]}, rest...), stdin, stdout, stderr, "auto")
}

func runArtifact(args []string, stdin io.Reader, stdout, stderr io.Writer, defaultType string) int {
	fs := flag.NewFlagSet("artifact", flag.ContinueOnError)
	fs.SetOutput(stderr)
	inputPath := fs.String("input", "", "artifact path, or - for stdin")
	artifactType := fs.String("type", defaultType, "contract|evidence|chain|value|auto")
	human := fs.Bool("human", false, "write a short human explanation to stderr")
	var keyPaths stringList
	fs.Var(&keyPaths, "key", "public verification key file (repeatable)")
	fs.Var(&keyPaths, "public-key", "alias for --key")
	if err := fs.Parse(args); err != nil {
		return exitInvocation
	}
	if fs.NArg() != 0 {
		fmt.Fprintln(stderr, "igris-verify: unexpected extra arguments")
		return exitInvocation
	}
	if *inputPath == "" {
		fmt.Fprintln(stderr, "igris-verify: --input is required")
		return exitInvocation
	}

	limits := verifier.DefaultLimits()
	input, err := readInput(*inputPath, stdin, limits)
	if err != nil {
		fmt.Fprintf(stderr, "igris-verify: %v\n", err)
		return exitIO
	}
	keys, err := loadKeys(keyPaths, limits)
	if err != nil {
		fmt.Fprintf(stderr, "igris-verify: %v\n", err)
		return exitIO
	}

	resolvedType := *artifactType
	if resolvedType == "auto" || resolvedType == "" {
		resolvedType = detectArtifactType(input, limits)
	}
	var requestType verifier.ArtifactType
	switch resolvedType {
	case "contract":
		requestType = verifier.ArtifactActionContract
	case "evidence":
		requestType = verifier.ArtifactEvidenceEvent
	case "chain":
		requestType = verifier.ArtifactEvidenceChain
	case "value":
		requestType = verifier.ArtifactLegacyValue
	default:
		fmt.Fprintln(stderr, "igris-verify: the artifact type could not be determined; pass --type contract|evidence|chain|value")
		return exitUnsupported
	}

	outcome := verifier.Verify(verifier.Request{
		Type:   requestType,
		Input:  input,
		Keys:   keys,
		Limits: limits,
	})
	encoded, err := outcome.Result.MarshalDeterministic()
	if err != nil {
		fmt.Fprintf(stderr, "igris-verify: result could not be encoded: %v\n", err)
		return exitIO
	}
	fmt.Fprintln(stdout, string(encoded))
	if *human {
		explainResult(stderr, outcome.Result)
	}
	return exitOK
}

// detectArtifactType classifies raw input structurally without weakening any
// later check. Structure, never whitespace, decides the framing: an input
// that parses as exactly one JSON document is always a single artifact
// (pretty-printing is irrelevant), and JSONL chain framing is considered
// only when the whole input is not one document and every non-empty line is
// itself a complete JSON object. Anything else is undetermined and fails
// closed; --type always bypasses detection.
func detectArtifactType(input []byte, limits verifier.Limits) string {
	if document, err := verifier.ParseLegacyJSON(input, limits); err == nil {
		// Exactly one JSON document: classify by its distinguishing
		// schema-1 members. An event_type member means an Evidence event; a
		// contract_hash member without event_type means an ActionContract.
		if document.Kind != verifier.KindObject {
			return ""
		}
		if document.Lookup("event_type") != nil {
			return "evidence"
		}
		if document.Lookup("contract_hash") != nil {
			return "contract"
		}
		return ""
	}
	// Not a single document: accept JSONL chain framing only when there are
	// at least two records and every non-empty line parses as one complete
	// JSON object under the per-event bound.
	perEvent := limits
	perEvent.MaxInputBytes = limits.MaxEventBytes
	records := 0
	for _, line := range strings.Split(string(input), "\n") {
		trimmed := strings.TrimSpace(strings.TrimRight(line, "\r"))
		if trimmed == "" {
			continue
		}
		record, err := verifier.ParseLegacyJSON([]byte(trimmed), perEvent)
		if err != nil || record.Kind != verifier.KindObject {
			return ""
		}
		records++
	}
	if records >= 2 {
		return "chain"
	}
	return ""
}

// explainResult writes a short human-readable interpretation to stderr using
// only registered enum values and issue codes — never payload values.
func explainResult(w io.Writer, result *verifier.Result) {
	fmt.Fprintf(w, "summary: %s\n", result.Summary)
	fmt.Fprintf(w, "object: %s, schema: %s, parse: %s, canonicalization: %s\n",
		result.Artifact.ObjectType, result.Schema, result.Parse, result.Canonicalization)
	fmt.Fprintf(w, "object_hash: %s, signature: %s, key_resolution: %s, trust: %s\n",
		result.ObjectHash, result.Signature, result.KeyResolution, result.Trust)
	if len(result.Issues) > 0 {
		codes := make([]string, 0, len(result.Issues))
		for _, issue := range result.Issues {
			codes = append(codes, issue.Code)
		}
		fmt.Fprintf(w, "issues: %s\n", strings.Join(codes, ", "))
	}
}

func runVectors(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("vectors", flag.ContinueOnError)
	fs.SetOutput(stderr)
	suite := fs.String("suite", "", "path to the frozen suite directory (containing manifest.json)")
	manifest := fs.String("manifest", "", "path to manifest.json (alias for --suite of its directory)")
	vectorID := fs.String("vector", "", "run only this vector ID")
	family := fs.String("family", "", "run only this vector family")
	capability := fs.String("capability", "", "run only vectors declaring this capability")
	if err := fs.Parse(args); err != nil {
		return exitInvocation
	}
	if fs.NArg() != 0 {
		fmt.Fprintln(stderr, "igris-verify: unexpected extra arguments")
		return exitInvocation
	}
	suitePath := *suite
	if suitePath == "" && *manifest != "" {
		suitePath = filepath.Dir(*manifest)
	}
	if suitePath == "" {
		fmt.Fprintln(stderr, "igris-verify vectors: --suite is required")
		return exitInvocation
	}
	report, err := runner.Run(suitePath, runner.Filter{
		VectorID:   *vectorID,
		Family:     *family,
		Capability: *capability,
	})
	if err != nil {
		fmt.Fprintf(stderr, "igris-verify vectors: %v\n", err)
		return exitInvocation
	}
	encoded, encodeErr := json.MarshalIndent(report, "", "  ")
	if encodeErr != nil {
		fmt.Fprintf(stderr, "igris-verify vectors: report could not be encoded: %v\n", encodeErr)
		return exitIO
	}
	fmt.Fprintln(stdout, string(encoded))
	if report.Status != "pass" {
		return exitMismatch
	}
	return exitOK
}

type stringList []string

func (l *stringList) String() string { return strings.Join(*l, ",") }
func (l *stringList) Set(value string) error {
	*l = append(*l, value)
	return nil
}

func readInput(path string, stdin io.Reader, limits verifier.Limits) ([]byte, error) {
	if path == "-" {
		return io.ReadAll(io.LimitReader(stdin, int64(limits.MaxInputBytes)+1))
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("input is unreadable: %s", path)
	}
	if info.Size() > int64(limits.MaxInputBytes)+1 {
		// Read one byte past the limit so the bounded parser reports
		// resource_limit instead of the CLI truncating silently.
		file, openErr := os.Open(path)
		if openErr != nil {
			return nil, fmt.Errorf("input is unreadable: %s", path)
		}
		defer file.Close()
		return io.ReadAll(io.LimitReader(file, int64(limits.MaxInputBytes)+1))
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("input is unreadable: %s", path)
	}
	return data, nil
}

// loadKeys loads each supplied public key and registers it under its computed
// schema-1 truncated key ID. Loading never trusts a caller-declared ID.
func loadKeys(paths []string, limits verifier.Limits) ([]verifier.KeyCandidate, error) {
	var candidates []verifier.KeyCandidate
	for _, path := range paths {
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("key file is unreadable: %s", path)
		}
		public, loadErr := verifier.LoadPublicKey(raw, limits)
		if loadErr != nil {
			return nil, fmt.Errorf("key file %s: %v", filepath.Base(path), loadErr)
		}
		candidates = append(candidates, verifier.KeyCandidate{
			ID:  verifier.TruncatedKeyID(public),
			Key: public,
		})
	}
	return candidates, nil
}
