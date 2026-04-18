//! Hybrid Mission Example: Deterministic BTree + LLM Reasoning
//!
//! Demonstrates:
//! - Deterministic outer loop (Sequence)
//! - LLM generates dynamic plan
//! - SubtreeLoader executes LLM plan
//! - ReplanOnFailure for automatic recovery
//!
//! Run with: cargo run --example hybrid_mission

use igris_btree::prelude::*;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();

    println!("🤖 Hybrid BTree Mission Demo");
    println!("================================\n");

    // Create mock LLM provider with navigation plan
    let llm = Arc::new(igris_btree::MockLlmProvider::with_navigation_plan());

    // Build hybrid tree
    let mut mission = Sequence::new("Hybrid Mission")
        // 1. Set mission task
        .add_child(Box::new(SetBlackboard::new(
            "set_task",
            "mission_task",
            "Navigate to warehouse and return",
        )))
        // 2. 🤖 LLM generates dynamic plan
        .add_child(Box::new(LLMPlannerNode::new(
            "llm_planner",
            "mission_task",
            "dynamic_plan",
        )))
        // 3. Load and execute LLM-generated plan
        .add_child(Box::new(SubtreeLoader::new("execute_plan", "dynamic_plan")));

    // Create execution context
    let mut context = BTreeContext::new().with_llm(llm);

    println!("📋 Starting mission execution...\n");

    // Execute tree
    let mut tick_count = 0;
    loop {
        tick_count += 1;
        context.tick_count = tick_count;

        println!("⏱️  Tick {}", tick_count);

        let status = mission.tick(&mut context).await?;

        match status {
            NodeStatus::Success => {
                println!("\n✅ Mission completed successfully!");
                println!("   Total ticks: {}", tick_count);
                break;
            }
            NodeStatus::Failure => {
                println!("\n❌ Mission failed!");
                println!("   Total ticks: {}", tick_count);
                break;
            }
            NodeStatus::Running => {
                println!("   Status: Running...");
                // Small delay for readability
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
            NodeStatus::Skipped => {
                println!("\n⏭️  Mission skipped");
                break;
            }
        }

        // Safety: max 20 ticks
        if tick_count >= 20 {
            println!("\n⚠️  Max ticks reached, stopping");
            break;
        }
    }

    // Show final blackboard state
    println!("\n📊 Final Blackboard State:");
    let keys = context.blackboard.keys().await;
    for key in keys {
        if let Some(value) = context.blackboard.get(&key).await {
            println!("   {}: {}", key, value);
        }
    }

    Ok(())
}
