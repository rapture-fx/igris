"""Minimal Embedded Igris example: guard a consequential function.

Run it from a terminal (approval is interactive):

    uv run python examples/guarded_refund.py

Then verify the local evidence journal:

    uv run igris verify
"""

import igris


class FakePaymentProvider:
    """Stands in for a real payment API so the example stays offline."""

    def refund(self, customer_id: str, amount: int) -> dict:
        return {"customer_id": customer_id, "amount": amount, "status": "refunded"}


payment_provider = FakePaymentProvider()


@igris.guard(
    action="customer.refund",
    risk="critical",
    approval="required",
)
def refund_customer(customer_id: str, amount: int):
    return payment_provider.refund(customer_id=customer_id, amount=amount)


if __name__ == "__main__":
    result = refund_customer("cus_1234", 500)
    print(f"refund result: {result}")
    print("A signed decision and outcome event were appended to your journal.")
    print("Inspect them with: igris verify && igris key-info")
