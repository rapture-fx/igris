# ROS2 End-to-End Integration Report

**Date:** 2026-03-26
**Sprint:** Deepening Sprint — Phase 2
**Status:** Implementation complete; Gazebo demo requires live ROS2 environment

---

## What Was Built

### 1. ROS2 BT Node Types (igris-btree)

**Files created/modified:**
- `igris-runtime/crates/igris-btree/Cargo.toml` — added `igris-ros2` optional dep, `ros2` feature flag
- `igris-runtime/crates/igris-btree/src/core/context.rs` — added `ros2_node: Option<Arc<Ros2Node>>`, `with_ros2()`, `has_ros2()`, `require_ros2()` methods
- `igris-runtime/crates/igris-btree/src/nodes/action/ros_nodes.rs` — **new** ROS BT node types (378 lines)
- `igris-runtime/crates/igris-btree/src/nodes/action/mod.rs` — exported ROS nodes behind `ros2` feature
- `igris-runtime/crates/igris-btree/src/lib.rs` — added ROS nodes to prelude

**New BT node types:**

| Node | Purpose | Key Fields |
|------|---------|-----------|
| `RosTopicPublish` | Publish JSON payload to ROS2 topic | topic, msg_type, payload, min_interval_ms |
| `RosTopicSubscribe` | Wait for message on ROS2 topic | topic, msg_type, timeout_ms, output_key |
| `RosServiceCall` | Call ROS2 service and store response | service, request, timeout_ms, output_key |

**Safety envelope checks (all nodes):**
- Payload size limit: 64 KiB (returns `Failure` if exceeded)
- Rate limiting: `min_interval_ms` prevents flood publishing
- `require_ros2()` returns `Failure` (not error) when no ROS node configured

### 2. BT Executor ↔ ROS Bridge Wiring (igris-server)

**Files modified:**
- `igris-runtime/crates/igris-server/src/main.rs` — added `ros2_manager` to `AppState` (feature-gated), wired `Ros2Node` into `btree_run` handler
- `igris-runtime/crates/igris-server/Cargo.toml` — added `ros2` feature that enables `igris-btree/ros2`

The `btree_run` handler now:
1. Checks `ros2_manager.is_safe_idle()` — blocks BT execution during containment halt
2. Injects `ros2_manager.node()` into `BTreeContext` via `with_ros2()`
3. ROS BT nodes automatically dispatch to the wired `Ros2Node`

### 3. Overture ROS Discovery + Publish Endpoints

**File modified:** `igris-overture/api/routes_fleet.go`

**New endpoints:**

| Endpoint | Description |
|----------|-------------|
| `GET /v1/ros/discovery?machine_id=...` | List topics/services discovered by runtime. Merges dynamic `ros_topics` JSONB from `runtime_instances` with static `ros_topic_mappings`. Deduplicates by topic name. |
| `POST /v1/ros/publish` | Queue a topic publish command to a specific runtime via `pending_commands`. Enforces 64 KiB payload limit. |

### 4. Console BT Editor — ROS Node Support

**File modified:** `web/apps/web-console/app/execution/bt-editor/page.tsx`

- Added `RosTopicPublish`, `RosTopicSubscribe`, `RosServiceCall` to `NodeType` union
- Added teal color palette for ROS2 nodes (visually distinct from standard nodes)
- Added "ROS2" palette section with separator in the left panel
- Added ROS badge on canvas nodes (green `ROS` pill on teal node boxes)
- Extended `TYPE_MAP` for JSON import/export roundtrip

### 5. Console ROS Monitor Page

**File created:** `web/apps/web-console/app/fleet/devices/[id]/ros-monitor/page.tsx`

**Features:**
- Live topic discovery panel (polls `/v1/ros/discovery` every 10s, stale indicator after 30s)
- Click-to-fill: selecting a topic auto-populates the publish form with topic name, message type, and default payload
- Publish test message panel with JSON textarea, payload size indicator (byte counter with 64 KiB limit warning)
- Quick presets: Move Forward, Stop, Turn Left, Turn Right (`/cmd_vel` Twist messages)
- Service list panel

**Navigation:** Added "Open ROS Monitor" link button in fleet device detail sheet (`fleet/devices/page.tsx`)

---

## Gazebo TurtleBot3 Demo Script

**Prerequisites:**
```bash
# Ubuntu 22.04 + ROS2 Humble
sudo apt install ros-humble-turtlebot3-gazebo
export TURTLEBOT3_MODEL=burger
source /opt/ros/humble/setup.bash
```

**BT definition for the demo:**
```json
{
  "type": "Sequence",
  "name": "robot_control",
  "children": [
    {
      "type": "RosTopicPublish",
      "name": "move_forward",
      "topic": "/cmd_vel",
      "msg_type": "geometry_msgs/Twist",
      "payload": {"linear": {"x": 0.5, "y": 0.0, "z": 0.0}, "angular": {"x": 0.0, "y": 0.0, "z": 0.0}},
      "min_interval_ms": 0
    },
    {
      "type": "Timeout",
      "name": "wait_2s",
      "timeout_ms": 2000,
      "child": {
        "type": "RosTopicSubscribe",
        "name": "wait_odometry",
        "topic": "/odom",
        "msg_type": "nav_msgs/Odometry",
        "timeout_ms": 1900,
        "output_key": "final_pose"
      }
    },
    {
      "type": "RosTopicPublish",
      "name": "stop",
      "topic": "/cmd_vel",
      "msg_type": "geometry_msgs/Twist",
      "payload": {"linear": {"x": 0.0, "y": 0.0, "z": 0.0}, "angular": {"x": 0.0, "y": 0.0, "z": 0.0}},
      "min_interval_ms": 0
    }
  ]
}
```

**Demo execution:**
```bash
# 1. Start Gazebo
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py

# 2. Start igris-runtime with ROS2 feature
cd igris-runtime
cargo run --bin igris-runtime --features ros2

# 3. POST BT to runtime (replace with actual endpoint)
curl -X POST http://localhost:8080/v1/btree/run \
  -H "Content-Type: application/json" \
  -d @demo_bt.json

# 4. Observe in Gazebo: robot moves forward ~1m then stops
# 5. Check console at /fleet/devices/[id]/ros-monitor for /cmd_vel activity
```

**Expected trace output:**
```
[RosTopicPublish] move_forward → /cmd_vel (geometry_msgs/Twist)
[RosTopicPublish] move_forward: publish OK
[RosTopicSubscribe] wait_odometry waiting on /odom (1900ms timeout)
[RosTopicSubscribe] wait_odometry received message
[RosTopicPublish] stop → /cmd_vel (geometry_msgs/Twist)
[RosTopicPublish] stop: publish OK
Execution completed: Success (tick_count=1, duration_ms=~2100)
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    igris-runtime                         │
│                                                         │
│  BTreeExecutor                                          │
│    └── btree_run handler                               │
│         ├── context.with_ros2(ros2_manager.node())     │
│         └── BT tree execution                          │
│              ├── RosTopicPublish.tick()                │
│              │    └── node.publish_prompt(payload)     │
│              ├── RosTopicSubscribe.tick()              │
│              │    └── node.receive_response()          │
│              └── RosServiceCall.tick()                 │
│                   └── node.publish_prompt() + recv     │
│                                                         │
│  Ros2Node (igris-ros2)                                 │
│    ├── publish_prompt → ROS2 topic                     │
│    ├── receive_response ← ROS2 topic                   │
│    └── publish_zero_velocity → /cmd_vel (safety)       │
│                                                         │
│  ContainmentBridge                                     │
│    └── ViolationEventBus → safe-idle gate              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   igris-overture                        │
│                                                         │
│  GET /v1/ros/discovery?machine_id=...                  │
│    └── Merges: ros_topics JSONB + ros_topic_mappings   │
│                                                         │
│  POST /v1/ros/publish                                  │
│    └── Queues ros_publish command via pending_commands │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 web-console                             │
│                                                         │
│  /execution/bt-editor                                  │
│    ├── RosTopicPublish node (teal palette)             │
│    ├── RosTopicSubscribe node                          │
│    └── RosServiceCall node                             │
│                                                         │
│  /fleet/devices/[id]/ros-monitor                       │
│    ├── Discovered topics list (10s poll)               │
│    ├── Publish test message + quick presets            │
│    └── Service list                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Blockers / Known Limitations

1. **Real r2r binding for `/cmd_vel`**: The `publish_prompt` method serializes to `std_msgs/String`. For actual `geometry_msgs/Twist` publishing, the `ros2` feature must be compiled with r2r bindings and a ROS2 environment. The stub implementation logs and echoes messages correctly for testing.

2. **Nav2 action client not implemented**: `navigate_to_pose()` uses simulated state progression (noted as TODO in igris-ros2/src/lib.rs line 582). A dedicated `RosNavigate` BT node is the next step after r2r nav2_msgs bindings are available.

3. **`ros_topics` JSONB column**: The `runtime_instances` table does not yet have a `ros_topics` JSONB column. The discovery endpoint gracefully handles its absence (falls back to static mappings). Migration needed: `ALTER TABLE runtime_instances ADD COLUMN ros_topics JSONB DEFAULT '[]'::jsonb`.

4. **Gazebo demo requires live environment**: The demo script above is verified against the code logic but cannot be executed in this context without a running ROS2 + Gazebo installation.
