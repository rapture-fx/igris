//! Integration tests for igris-btree
//!
//! These tests verify end-to-end behavior of complex trees with multiple nodes,
//! hybrid LLM flows, and real-world scenarios.

use igris_btree::nodes::composite::ParallelPolicy;
use igris_btree::prelude::*;
use igris_btree::MockLlmProvider;
use std::sync::Arc;
use std::time::Duration;

// ============================================================================
// Complex Sequence Tests
// ============================================================================

#[tokio::test]
async fn test_complex_sequence_success() {
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    let mut tree = Sequence::new("mission")
        .add_child(Box::new(SetBlackboard::new("init", "phase", "init")))
        .add_child(Box::new(SetBlackboard::new("plan", "phase", "planning")))
        .add_child(Box::new(SetBlackboard::new(
            "execute",
            "phase",
            "executing",
        )))
        .add_child(Box::new(SetBlackboard::new("finish", "phase", "done")));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_success());
    assert_eq!(result.tick_count, 1);
    assert_eq!(
        context.blackboard.get("phase").await.unwrap().as_str(),
        Some("done")
    );
}

#[tokio::test]
async fn test_sequence_with_failure() {
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    // Create a failing node
    use anyhow::Result;
    use async_trait::async_trait;

    struct FailNode;
    #[async_trait]
    impl BTreeNode for FailNode {
        fn name(&self) -> &str {
            "fail"
        }
        fn node_type(&self) -> &str {
            "Fail"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            Ok(NodeStatus::Failure)
        }
        async fn reset(&mut self) {}
        fn to_json(&self) -> Result<serde_json::Value> {
            Ok(serde_json::json!({"type": "Fail"}))
        }
    }

    let mut tree = Sequence::new("mission")
        .add_child(Box::new(SetBlackboard::new("step1", "done", "step1")))
        .add_child(Box::new(FailNode))
        .add_child(Box::new(SetBlackboard::new("step3", "done", "step3")));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_failure());
    // Should stop after failing node
    assert_eq!(
        context.blackboard.get("done").await.unwrap().as_str(),
        Some("step1")
    );
}

// ============================================================================
// Selector/Fallback Tests
// ============================================================================

#[tokio::test]
async fn test_selector_fallback_chain() {
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    use anyhow::Result;
    use async_trait::async_trait;

    struct FailNode(String);
    #[async_trait]
    impl BTreeNode for FailNode {
        fn name(&self) -> &str {
            &self.0
        }
        fn node_type(&self) -> &str {
            "Fail"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            Ok(NodeStatus::Failure)
        }
        async fn reset(&mut self) {}
        fn to_json(&self) -> Result<serde_json::Value> {
            Ok(serde_json::json!({"type": "Fail"}))
        }
    }

    let mut tree = Selector::new("fallback")
        .add_child(Box::new(FailNode("primary".to_string())))
        .add_child(Box::new(FailNode("secondary".to_string())))
        .add_child(Box::new(SetBlackboard::new(
            "tertiary", "method", "tertiary",
        )));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_success());
    assert_eq!(
        context.blackboard.get("method").await.unwrap().as_str(),
        Some("tertiary")
    );
}

// ============================================================================
// Decorator Tests
// ============================================================================

#[tokio::test]
async fn test_retry_with_eventual_success() {
    let mut context = BTreeContext::new();

    use anyhow::Result;
    use async_trait::async_trait;

    struct FlakeyNode {
        attempts: std::sync::Mutex<u32>,
    }
    #[async_trait]
    impl BTreeNode for FlakeyNode {
        fn name(&self) -> &str {
            "flakey"
        }
        fn node_type(&self) -> &str {
            "Flakey"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            let mut attempts = self.attempts.lock().unwrap();
            *attempts += 1;
            if *attempts >= 3 {
                Ok(NodeStatus::Success)
            } else {
                Ok(NodeStatus::Failure)
            }
        }
        async fn reset(&mut self) {}
        fn to_json(&self) -> Result<serde_json::Value> {
            Ok(serde_json::json!({"type": "Flakey"}))
        }
    }

    let flakey = Box::new(FlakeyNode {
        attempts: std::sync::Mutex::new(0),
    });
    let mut retry = Retry::new("retry", flakey, 5);

    let status = retry.tick(&mut context).await.unwrap();
    assert_eq!(status, NodeStatus::Success);
}

#[tokio::test]
async fn test_timeout_enforcement() {
    let mut context = BTreeContext::new();

    use anyhow::Result;
    use async_trait::async_trait;

    struct SlowNode;
    #[async_trait]
    impl BTreeNode for SlowNode {
        fn name(&self) -> &str {
            "slow"
        }
        fn node_type(&self) -> &str {
            "Slow"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            tokio::time::sleep(Duration::from_millis(20)).await;
            Ok(NodeStatus::Running)
        }
        async fn reset(&mut self) {}
        fn to_json(&self) -> Result<serde_json::Value> {
            Ok(serde_json::json!({"type": "Slow"}))
        }
    }

    let slow = Box::new(SlowNode);
    let mut timeout = Timeout::new("timeout", slow, 50);

    // Tick multiple times until timeout triggers
    let mut last_status = NodeStatus::Running;
    for _ in 0..10 {
        last_status = timeout.tick(&mut context).await.unwrap();
        if last_status != NodeStatus::Running {
            break;
        }
    }

    // Should have failed due to timeout
    assert_eq!(last_status, NodeStatus::Failure);
}

#[tokio::test]
async fn test_repeat_finite() {
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    context
        .blackboard
        .set("counter", serde_json::json!(0))
        .await;

    use anyhow::Result;
    use async_trait::async_trait;

    struct IncrementNode;
    #[async_trait]
    impl BTreeNode for IncrementNode {
        fn name(&self) -> &str {
            "increment"
        }
        fn node_type(&self) -> &str {
            "Increment"
        }
        async fn tick(&mut self, context: &mut BTreeContext) -> Result<NodeStatus> {
            let count = context
                .blackboard
                .get("counter")
                .await
                .unwrap()
                .as_i64()
                .unwrap();
            context
                .blackboard
                .set("counter", serde_json::json!(count + 1))
                .await;
            Ok(NodeStatus::Success)
        }
        async fn reset(&mut self) {}
        fn to_json(&self) -> Result<serde_json::Value> {
            Ok(serde_json::json!({"type": "Increment"}))
        }
    }

    let mut tree = Repeat::new("repeat", Box::new(IncrementNode), Some(5));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_success());
    assert_eq!(
        context.blackboard.get("counter").await.unwrap().as_i64(),
        Some(5)
    );
}

// ============================================================================
// Hybrid LLM Tests
// ============================================================================

#[tokio::test]
async fn test_hybrid_llm_planning_flow() {
    let provider = Arc::new(MockLlmProvider::with_navigation_plan());
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new().with_llm(provider);

    let mut tree = Sequence::new("hybrid_mission")
        .add_child(Box::new(SetBlackboard::new(
            "set_task",
            "mission_task",
            "Navigate to warehouse",
        )))
        .add_child(Box::new(LLMPlannerNode::new(
            "planner",
            "mission_task",
            "dynamic_plan",
        )))
        .add_child(Box::new(SubtreeLoader::new("loader", "dynamic_plan")));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_success());
    assert!(context.blackboard.contains("dynamic_plan").await);
    assert!(context.blackboard.contains("mission_task").await);
}

#[tokio::test]
async fn test_replan_on_failure() {
    let provider = Arc::new(MockLlmProvider::with_recovery_plan());
    let mut context = BTreeContext::new().with_llm(provider);

    use anyhow::Result;
    use async_trait::async_trait;

    struct AlwaysFailNode;
    #[async_trait]
    impl BTreeNode for AlwaysFailNode {
        fn name(&self) -> &str {
            "always_fail"
        }
        fn node_type(&self) -> &str {
            "AlwaysFail"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            Ok(NodeStatus::Failure)
        }
        async fn reset(&mut self) {}
        fn to_json(&self) -> Result<serde_json::Value> {
            Ok(serde_json::json!({"type": "AlwaysFail"}))
        }
    }

    context
        .blackboard
        .set("task", serde_json::json!("Test task"))
        .await;

    let child = Box::new(AlwaysFailNode);

    let mut replan = ReplanOnFailure::new("replan", child, "task").with_max_replans(2);

    // Should fail after child fails and max replans exceeded
    let status = replan.tick(&mut context).await.unwrap();
    assert_eq!(status, NodeStatus::Failure);

    // Verify that replanning was attempted (check blackboard for replanned_subtree)
    assert!(context.blackboard.contains("replanned_subtree").await);
}

// ============================================================================
// Parallel Execution Tests
// ============================================================================

#[tokio::test]
async fn test_parallel_all_succeed() {
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    let mut tree = Parallel::new("parallel", ParallelPolicy::RequireAll)
        .add_child(Box::new(SetBlackboard::new("task1", "result1", "done1")))
        .add_child(Box::new(SetBlackboard::new("task2", "result2", "done2")))
        .add_child(Box::new(SetBlackboard::new("task3", "result3", "done3")));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_success());
    assert!(context.blackboard.contains("result1").await);
    assert!(context.blackboard.contains("result2").await);
    assert!(context.blackboard.contains("result3").await);
}

#[tokio::test]
async fn test_parallel_require_one() {
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    use anyhow::Result;
    use async_trait::async_trait;

    struct FailNode;
    #[async_trait]
    impl BTreeNode for FailNode {
        fn name(&self) -> &str {
            "fail"
        }
        fn node_type(&self) -> &str {
            "Fail"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            Ok(NodeStatus::Failure)
        }
        async fn reset(&mut self) {}
        fn to_json(&self) -> Result<serde_json::Value> {
            Ok(serde_json::json!({"type": "Fail"}))
        }
    }

    let mut tree = Parallel::new("parallel", ParallelPolicy::RequireOne)
        .add_child(Box::new(FailNode))
        .add_child(Box::new(SetBlackboard::new("success", "result", "done")))
        .add_child(Box::new(FailNode));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_success());
    assert!(context.blackboard.contains("result").await);
}

// ============================================================================
// Safety Tests
// ============================================================================

#[tokio::test]
async fn test_watchdog_prevents_infinite_loop() {
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    let infinite = Box::new(Repeat::infinite(
        "infinite",
        Box::new(SetBlackboard::new("tick", "counter", "tick")),
    ));

    let mut tree = Watchdog::new("safety", infinite, Duration::from_millis(50));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    // Watchdog should have stopped the infinite loop
    assert!(result.is_failure());
}

#[tokio::test]
async fn test_executor_max_ticks() {
    let executor = BTreeExecutor::new().with_max_ticks(10);
    let mut context = BTreeContext::new();

    let mut tree = Repeat::infinite(
        "infinite",
        Box::new(SetBlackboard::new("tick", "active", true)),
    );

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.max_ticks_reached);
    assert!(result.is_interrupted());
    assert_eq!(result.tick_count, 10);
}

#[tokio::test]
async fn test_executor_deadline() {
    let executor = BTreeExecutor::new().with_deadline(Duration::from_millis(100));

    let mut context = BTreeContext::new();

    use anyhow::Result;
    use async_trait::async_trait;

    struct SlowNode;
    #[async_trait]
    impl BTreeNode for SlowNode {
        fn name(&self) -> &str {
            "slow"
        }
        fn node_type(&self) -> &str {
            "Slow"
        }
        async fn tick(&mut self, _context: &mut BTreeContext) -> Result<NodeStatus> {
            tokio::time::sleep(Duration::from_millis(30)).await;
            Ok(NodeStatus::Running)
        }
        async fn reset(&mut self) {}
        fn to_json(&self) -> Result<serde_json::Value> {
            Ok(serde_json::json!({"type": "Slow"}))
        }
    }

    let mut tree = SlowNode;
    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.deadline_exceeded);
    assert!(result.is_interrupted());
}

// ============================================================================
// Nested Tree Tests
// ============================================================================

#[tokio::test]
async fn test_deeply_nested_tree() {
    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    let mut tree = Sequence::new("root")
        .add_child(Box::new(SetBlackboard::new("start", "phase", "start")))
        .add_child(Box::new(
            Selector::new("fallback")
                .add_child(Box::new(
                    Sequence::new("inner_seq")
                        .add_child(Box::new(SetBlackboard::new("inner1", "step", "1")))
                        .add_child(Box::new(SetBlackboard::new("inner2", "step", "2"))),
                ))
                .add_child(Box::new(SetBlackboard::new("fallback", "step", "fallback"))),
        ))
        .add_child(Box::new(SetBlackboard::new("end", "phase", "end")));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_success());
    assert_eq!(
        context.blackboard.get("phase").await.unwrap().as_str(),
        Some("end")
    );
    assert_eq!(
        context.blackboard.get("step").await.unwrap().as_str(),
        Some("2")
    );
}

// ============================================================================
// JSON Parser Integration Tests
// ============================================================================

#[tokio::test]
async fn test_json_parser_complex_tree() {
    let parser = JsonTreeParser::new();
    let context = BTreeContext::new();

    let json = serde_json::json!({
        "type": "Sequence",
        "name": "Mission",
        "children": [
            {
                "type": "Action",
                "name": "Init",
                "tool": "init",
                "args": {"phase": "start"}
            },
            {
                "type": "Selector",
                "name": "Strategy",
                "children": [
                    {
                        "type": "Action",
                        "name": "Primary",
                        "tool": "primary",
                        "args": {}
                    },
                    {
                        "type": "Action",
                        "name": "Fallback",
                        "tool": "fallback",
                        "args": {}
                    }
                ]
            },
            {
                "type": "Condition",
                "name": "Check",
                "key": "status",
                "expected": "ready"
            }
        ]
    });

    let tree = parser.parse_node(&json, &context).unwrap();

    assert_eq!(tree.name(), "Mission");
    assert_eq!(tree.node_type(), "Sequence");
}

// ============================================================================
// Cancellation Tests
// ============================================================================

#[tokio::test]
async fn test_executor_cancellation() {
    use tokio::sync::watch;

    let executor = BTreeExecutor::new();
    let mut context = BTreeContext::new();

    let (cancel_tx, cancel_rx) = watch::channel(false);

    let mut tree = Repeat::infinite(
        "infinite",
        Box::new(SetBlackboard::new("tick", "active", true)),
    );

    let handle = tokio::spawn(async move {
        executor
            .execute_with_cancel(&mut tree, &mut context, cancel_rx)
            .await
    });

    // Wait a bit, then cancel
    tokio::time::sleep(Duration::from_millis(10)).await;
    cancel_tx.send(true).unwrap();

    let result = handle.await.unwrap().unwrap();

    assert!(result.cancelled);
    assert!(result.is_interrupted());
    assert!(result.tick_count > 0);
}

// ============================================================================
// Real-World Scenario Tests
// ============================================================================

#[tokio::test]
async fn test_robot_navigation_scenario() {
    let provider = Arc::new(MockLlmProvider::with_navigation_plan());
    let executor = BTreeExecutor::new()
        .with_max_ticks(100)
        .with_deadline(Duration::from_secs(10));

    let mut context = BTreeContext::new().with_llm(provider);

    // Simulate a robot navigation mission
    let mut tree = Sequence::new("robot_navigation")
        // 1. Initialize
        .add_child(Box::new(SetBlackboard::new(
            "init",
            "robot_state",
            "initialized",
        )))
        // 2. Plan route with LLM
        .add_child(Box::new(SetBlackboard::new(
            "set_goal",
            "goal",
            "warehouse_dock",
        )))
        .add_child(Box::new(LLMPlannerNode::new("plan_route", "goal", "route")))
        // 3. Execute route
        .add_child(Box::new(SubtreeLoader::new("execute_route", "route")))
        // 4. Verify arrival
        .add_child(Box::new(SetBlackboard::new(
            "verify",
            "robot_state",
            "arrived",
        )));

    let result = executor.execute(&mut tree, &mut context).await.unwrap();

    assert!(result.is_success());
    assert!(context.blackboard.contains("route").await);
    assert_eq!(
        context
            .blackboard
            .get("robot_state")
            .await
            .unwrap()
            .as_str(),
        Some("arrived")
    );
}
