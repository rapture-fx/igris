"""Local signing identity: creation, permissions, stability, hygiene."""

from __future__ import annotations

import os
import stat

import pytest

from igris import identity as identity_mod
from igris.errors import IdentityError
from igris.identity import LocalSigningIdentity, load_public_key, verify_signature


class TestCreation:
    def test_first_use_creates_keys(self, igris_home):
        identity = LocalSigningIdentity.load_or_create()
        assert (igris_home / "signing_key.pem").exists()
        assert (igris_home / "verify_key.pem").exists()
        assert identity.key_id.startswith("ed25519:")

    @pytest.mark.skipif(os.name != "posix", reason="POSIX permissions")
    def test_restrictive_permissions(self, igris_home):
        LocalSigningIdentity.load_or_create()
        dir_mode = stat.S_IMODE(igris_home.stat().st_mode)
        key_mode = stat.S_IMODE((igris_home / "signing_key.pem").stat().st_mode)
        assert dir_mode == 0o700
        assert key_mode == 0o600

    def test_key_id_stable_across_loads(self, igris_home):
        first = LocalSigningIdentity.load_or_create()
        second = LocalSigningIdentity.load_or_create()
        assert first.key_id == second.key_id
        assert first.fingerprint == second.fingerprint

    def test_igris_home_env_override(self, igris_home):
        assert identity_mod.igris_home() == igris_home
        assert identity_mod.default_journal_path() == igris_home / "journal.jsonl"

    def test_corrupt_private_key_fails_closed(self, igris_home):
        igris_home.mkdir(parents=True)
        (igris_home / "signing_key.pem").write_text("garbage")
        with pytest.raises(IdentityError):
            LocalSigningIdentity.load_or_create()


class TestSigning:
    def test_sign_verify_roundtrip(self, igris_home):
        identity = LocalSigningIdentity.load_or_create()
        digest = b"\x01" * 32
        signature = identity.sign(digest)
        public = load_public_key(identity.public_key_path)
        assert verify_signature(public, digest, signature)
        assert not verify_signature(public, b"\x02" * 32, signature)
        assert not verify_signature(public, digest, "!!not-base64!!")

    def test_private_key_material_not_exposed(self, igris_home):
        identity = LocalSigningIdentity.load_or_create()
        private_pem = (igris_home / "signing_key.pem").read_text()
        for text in (identity.key_id, identity.fingerprint, str(identity.public_key_path)):
            assert "PRIVATE KEY" not in text
        assert "PRIVATE KEY" in private_pem  # sanity: file itself is the key
