"""Summarize the event classes in an Igris JSONL journal."""

import argparse
import json
import os
from collections import Counter
from pathlib import Path


def default_journal() -> Path:
    home = Path(os.environ.get("IGRIS_HOME", Path.home() / ".igris")).expanduser()
    return home / "journal.jsonl"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("journal", nargs="?", type=Path, default=default_journal())
    args = parser.parse_args()

    counts: Counter[str] = Counter()
    action_counts: Counter[str] = Counter()
    with args.journal.open(encoding="utf-8") as journal_file:
        for line_number, line in enumerate(journal_file, start=1):
            event = json.loads(line)
            event_type = event.get("event_type")
            if event_type == "decision":
                label = f"decision.{event.get('decision')}"
            elif event_type == "outcome":
                label = f"outcome.{event.get('status')}"
            else:
                raise ValueError(f"line {line_number}: unknown event_type {event_type!r}")
            counts[label] += 1
            action_counts[str(event.get("action_name"))] += 1

    print(f"journal: {args.journal}")
    print(f"events: {sum(counts.values())}")
    for label in ("decision.allowed", "decision.denied", "outcome.succeeded", "outcome.failed"):
        print(f"{label}: {counts[label]}")
    for action, count in sorted(action_counts.items()):
        print(f"action {action}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
