package roles

import _ "embed"

// ExpectedV069PostRoleStructureSHA256 pins the PostgreSQL 16 canonical v2
// structure produced by the v069 bootstrap followed by role provisioning.
// Owners and ACLs remain in the separate role-model verification layer.
const ExpectedV069PostRoleStructureSHA256 = "d166fffa05546550ebb8fb3d613ea96ef977c4376461c9cb5a10d0359a9946a0"

//go:embed schema_structure_manifest.sql
var schemaStructureManifestSQL string
