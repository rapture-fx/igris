"""
Igris Inertial — Python hello world
Requires: pip install igris-inertial

Usage:
  export IGRIS_API_KEY=igris_...
  python hello_world.py
"""

import os
from igris import IgrisClient, InferRequest, Message

api_key = os.environ.get("IGRIS_API_KEY")
if not api_key:
    raise SystemExit("Set IGRIS_API_KEY first: export IGRIS_API_KEY=igris_...")

client = IgrisClient(
    base_url="https://overture.igrisinertial.com",
    api_key=api_key,
)

response = client.infer(InferRequest(
    model="gpt-4",
    messages=[Message(role="user", content="Hello! Reply in one sentence.")],
    max_tokens=64,
))

print(response.choices[0].message.content)
print(f"Provider : {response.metadata.provider if response.metadata else '—'}")
print(f"Latency  : {response.metadata.latency_ms if response.metadata else '—'} ms")
print(f"Cost     : ${response.metadata.cost_usd:.6f}" if response.metadata else "Cost: —")
