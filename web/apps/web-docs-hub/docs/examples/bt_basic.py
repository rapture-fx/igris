"""
Igris Inertial — Behavior Tree construction and execution example
Requires: pip install igris-inertial

Usage:
  export IGRIS_API_KEY=igris_...
  python bt_basic.py
"""

import os
from igris import IgrisClient
from igris.btree import Sequence, Selector, Action, Condition

api_key = os.environ.get("IGRIS_API_KEY")
if not api_key:
    raise SystemExit("Set IGRIS_API_KEY first: export IGRIS_API_KEY=igris_...")

client = IgrisClient(
    base_url="https://overture.igrisinertial.com",
    api_key=api_key,
)

# Build a navigation BT:
# Selector[
#   Sequence[CheckBattery, MoveToGoal],
#   Sequence[AlertLowBattery, ReturnHome]
# ]
tree = Selector([
    Sequence([
        Condition("check_battery", key="battery_level", expected=20),
        Action("move_to_goal", params={"target": "waypoint_A", "speed": 0.5}),
    ]),
    Sequence([
        Action("alert_low_battery"),
        Action("return_home", params={"speed": 0.3}),
    ]),
])

# Validate the tree locally
errors = tree.validate()
if errors:
    raise SystemExit(f"BT validation errors: {errors}")

print("BT JSON:")
import json
print(json.dumps(tree.to_dict(), indent=2))

# Submit for execution (requires a registered runtime agent)
agent_id = os.environ.get("IGRIS_AGENT_ID")
if agent_id:
    result = client.execute_bt(agent_id=agent_id, tree=tree)
    print(f"\nExecution ID : {result.execution_id}")
    print(f"Status       : {result.status}")
else:
    print("\n(Set IGRIS_AGENT_ID to submit for execution)")
