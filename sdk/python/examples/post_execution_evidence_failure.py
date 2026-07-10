"""Handle a post-execution evidence persistence failure without retrying.

This example uses a synthetic journal sink that accepts the decision event and
then fails the outcome write. That models the dangerous case: the consequential
function has already run, but the final evidence event is incomplete.
"""

from collections.abc import Callable
from pathlib import Path

import igris
from igris.journal import FileJournal


class OutcomeWriteFailsJournal:
    def __init__(self, path: Path) -> None:
        self._inner = FileJournal(path)
        self._appends = 0

    @property
    def path(self) -> Path:
        return self._inner.path

    def append_event(self, build: Callable[[str | None], dict]) -> dict:
        self._appends += 1
        if self._appends >= 2:
            raise RuntimeError("simulated local disk failure")
        return self._inner.append_event(build)


journal = OutcomeWriteFailsJournal(Path(".igris-example/journal.jsonl"))


@igris.guard(action="customer.refund", approval="never", journal=journal)
def refund_customer(customer_id: str, amount_cents: int) -> dict:
    return {"customer_id": customer_id, "amount_cents": amount_cents, "status": "refunded"}


if __name__ == "__main__":
    try:
        refund_customer("cus_demo", 500)
    except igris.ExecutionCompletedEvidenceError as exc:
        print(f"execution_occurred={exc.execution_occurred}")
        print(f"execution_state={exc.execution_state}")
        print(f"evidence_state={exc.evidence_state}")
        print(f"retry_safe={exc.retry_safe}")
        print(f"result={exc.result}")
        print("Do not retry automatically; send to operator review or reconcile external state.")
