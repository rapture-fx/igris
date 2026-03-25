"""
Igris Inertial — Behavior Tree construction and execution example
Requires: pip install igris-inertial

Usage:
  export IGRIS_RUNTIME_URL=http://localhost:8080   # or wherever your runtime is
  python bt_basic.py
"""

import json
import os
from igris import Runtime, RuntimeConfig
from igris.btree import BehaviorTree, Selector, Sequence, Action, Condition

runtime = Runtime(RuntimeConfig(
    local_url=os.environ.get("IGRIS_RUNTIME_URL", "http://localhost:8080"),
))

# Build a navigation BT:
# Selector[
#   Sequence[CheckBattery, MoveToGoal],
#   Sequence[AlertLowBattery, ReturnHome]
# ]
tree = BehaviorTree.from_nodes(
    Selector("nav-root", [
        Sequence("primary-path", [
            Condition("check_battery", key="battery_level", expected=20),
            Action("move_to_goal", tool="move_to", args={"target": "waypoint_A", "speed": 0.5}),
        ]),
        Sequence("fallback-path", [
            Action("alert_low_battery", tool="send_alert", args={"level": "warning"}),
            Action("return_home", tool="move_to", args={"target": "home", "speed": 0.3}),
        ]),
    ]),
    runtime,
)

print("BT JSON:")
print(json.dumps(tree.tree, indent=2))

# Validate against the running runtime
result = tree.validate()
print(f"\nValid      : {result['valid']}")
print(f"Root type  : {result.get('root_type', '—')}")

# Execute (runtime must be running and reachable)
execution = tree.run(context={"battery_level": 15})
print(f"\nStatus     : {execution['status']}")
print(f"Tick count : {execution['tick_count']}")
