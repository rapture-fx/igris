package roles

import _ "embed"

// ExpectedV069PostRoleStructureSHA256 pins the ACL/ownership-invariant
// structure produced by the v069 bootstrap followed by role provisioning.
// It is deliberately separate from bootstrap.ExpectedV069SchemaSHA256.
const ExpectedV069PostRoleStructureSHA256 = "4e852bad6ef9041c3b720fb683f83cc23cf5e7f9fd0f65bd1a344da63fc2b118"

//go:embed schema_structure_manifest.sql
var schemaStructureManifestSQL string
