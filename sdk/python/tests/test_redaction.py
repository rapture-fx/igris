"""Redaction: sensitive names, case-insensitivity, nesting, and scrubbing."""

from __future__ import annotations

from igris.redaction import (
    REDACTED,
    SENSITIVE_NAMES,
    bounded_summary,
    build_sensitive_set,
    collect_sensitive_raw_values,
    redact_arguments,
    scrub_text,
)


class TestNameMatching:
    def test_all_builtin_names_redacted(self):
        arguments = {name: f"raw-{name}" for name in SENSITIVE_NAMES}
        redacted = redact_arguments(arguments, SENSITIVE_NAMES)
        assert all(value == REDACTED for value in redacted.values())

    def test_case_insensitive(self):
        redacted = redact_arguments(
            {"API_KEY": "raw1", "Password": "raw2", "TOKEN": "raw3"}, SENSITIVE_NAMES
        )
        assert list(redacted.values()) == [REDACTED, REDACTED, REDACTED]

    def test_caller_declared_names(self):
        sensitive = build_sensitive_set(["Card_Number"])
        redacted = redact_arguments({"card_number": "4111-1111"}, sensitive)
        assert redacted["card_number"] == REDACTED

    def test_non_sensitive_values_untouched(self):
        redacted = redact_arguments({"amount": 100, "note": "hello"}, SENSITIVE_NAMES)
        assert redacted == {"amount": 100, "note": "hello"}


class TestNestedRedaction:
    def test_nested_dict_keys_redacted(self):
        arguments = {
            "config": {
                "authorization": "Bearer raw-token",
                "servers": [{"password": "raw-pass", "host": "db1"}],
            }
        }
        redacted = redact_arguments(arguments, SENSITIVE_NAMES)
        assert redacted["config"]["authorization"] == REDACTED
        assert redacted["config"]["servers"][0]["password"] == REDACTED
        assert redacted["config"]["servers"][0]["host"] == "db1"


class TestSummary:
    def test_summary_never_contains_secret(self):
        redacted = redact_arguments(
            {"api_key": "sk-live-very-secret", "amount": 5}, SENSITIVE_NAMES
        )
        summary = bounded_summary(redacted)
        assert "sk-live-very-secret" not in summary
        assert "amount=5" in summary

    def test_summary_is_bounded(self):
        redacted = {"blob": "y" * 100_000}
        assert len(bounded_summary(redacted)) < 3000


class TestScrubText:
    def test_raw_values_collected_and_scrubbed(self):
        arguments = {"token": "tok-12345678", "nested": {"client_secret": "cs-999999"}}
        raw = collect_sensitive_raw_values(arguments, SENSITIVE_NAMES)
        assert set(raw) == {"tok-12345678", "cs-999999"}
        scrubbed = scrub_text("failed: tok-12345678 / cs-999999", raw)
        assert "tok-12345678" not in scrubbed
        assert "cs-999999" not in scrubbed

    def test_scrub_truncates(self):
        assert len(scrub_text("z" * 10_000, [], max_chars=300)) <= 320
