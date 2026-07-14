package roles

import (
	"database/sql"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStructuralManifestCanonicalEncodingPreservesFullText(t *testing.T) {
	prefix := strings.Repeat("same-prefix-", 8)
	left := []structuralManifestRow{{
		ObjectType:     "function",
		SchemaName:     "public",
		ObjectIdentity: "reject_connected_immutable_record_mutation()",
		AttributeName:  "definition",
		AttributeValue: sql.NullString{String: prefix + "reject", Valid: true},
	}}
	right := []structuralManifestRow{{
		ObjectType:     "function",
		SchemaName:     "public",
		ObjectIdentity: "reject_connected_immutable_record_mutation()",
		AttributeName:  "definition",
		AttributeValue: sql.NullString{String: prefix + "allow", Valid: true},
	}}

	require.Greater(t, len(prefix), 63)
	leftHash, err := hashStructuralManifestRows(left)
	require.NoError(t, err)
	rightHash, err := hashStructuralManifestRows(right)
	require.NoError(t, err)
	require.NotEqual(t, leftHash, rightHash)
}

func TestStructuralManifestCanonicalEncodingDistinguishesNullEmptyAndBoundaries(t *testing.T) {
	base := structuralManifestRow{
		ObjectType:     "column",
		SchemaName:     "public",
		ObjectIdentity: "example.value",
		AttributeName:  "default",
	}
	nullHash, err := hashStructuralManifestRows([]structuralManifestRow{base})
	require.NoError(t, err)

	base.AttributeValue = sql.NullString{String: "", Valid: true}
	emptyHash, err := hashStructuralManifestRows([]structuralManifestRow{base})
	require.NoError(t, err)
	require.NotEqual(t, nullHash, emptyHash)

	leftHash, err := hashStructuralManifestRows([]structuralManifestRow{{
		ObjectType:     "rule",
		SchemaName:     "public",
		ObjectIdentity: "a\x1fb",
		AttributeName:  "c",
		AttributeValue: sql.NullString{String: "d", Valid: true},
	}})
	require.NoError(t, err)
	rightHash, err := hashStructuralManifestRows([]structuralManifestRow{{
		ObjectType:     "rule",
		SchemaName:     "public",
		ObjectIdentity: "a",
		AttributeName:  "b\x1fc",
		AttributeValue: sql.NullString{String: "d", Valid: true},
	}})
	require.NoError(t, err)
	require.NotEqual(t, leftHash, rightHash)
}

func TestStructuralManifestCanonicalEncodingIsDeterministicAndOrderSensitive(t *testing.T) {
	rows := []structuralManifestRow{
		{
			ObjectType:     "function",
			SchemaName:     "public",
			ObjectIdentity: "a()",
			AttributeName:  "definition",
			AttributeValue: sql.NullString{String: "alpha", Valid: true},
		},
		{
			ObjectType:     "trigger",
			SchemaName:     "public",
			ObjectIdentity: "table.trigger",
			AttributeName:  "enabled_mode",
			AttributeValue: sql.NullString{String: "O", Valid: true},
		},
	}
	first, err := hashStructuralManifestRows(rows)
	require.NoError(t, err)
	second, err := hashStructuralManifestRows(rows)
	require.NoError(t, err)
	require.Equal(t, first, second)

	reversed := []structuralManifestRow{rows[1], rows[0]}
	reversedHash, err := hashStructuralManifestRows(reversed)
	require.NoError(t, err)
	require.NotEqual(t, first, reversedHash)
}
