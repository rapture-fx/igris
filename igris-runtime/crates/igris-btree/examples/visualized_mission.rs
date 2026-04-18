//! Visualized Mission Example: BTree with Real-time Monitoring
//!
//! Demonstrates:
//! - Tree execution with visualization enabled
//! - Real-time state export to JSON
//! - Metrics collection (tick rate, replan count, etc.)
//! - Execution trace and replan events
//!
//! Run with: cargo run --example visualized_mission

use igris_btree::prelude::*;
use igris_btree::visualizer::{TreeVisualizer, VisualizerConfig};
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();

    println!("🎨 Visualized BTree Mission Demo");
    println!("==================================\n");

    // Create visualizer with custom config
    let viz_config = VisualizerConfig {
        enabled: true,
        max_trace_entries: 50,
        max_replan_events: 10,
        export_frequency: 0, // Every tick
        compute_diffs: true,
        blackboard_filter: None, // Include all keys
    };

    let visualizer = Arc::new(TreeVisualizer::with_config(viz_config));

    // Create executor with visualizer
    let executor = BTreeExecutor::new()
        .with_max_ticks(20)
        .with_tracing(true)
        .with_visualizer(visualizer.clone());

    // Create mock LLM provider
    let llm = Arc::new(igris_btree::MockLlmProvider::with_navigation_plan());

    // Build hybrid tree
    let mut mission = Sequence::new("Visualized Mission")
        .add_child(Box::new(SetBlackboard::new("init", "status", "starting")))
        .add_child(Box::new(SetBlackboard::new(
            "set_task",
            "mission_task",
            "Navigate warehouse and collect inventory",
        )))
        .add_child(Box::new(LLMPlannerNode::new(
            "planner",
            "mission_task",
            "dynamic_plan",
        )))
        .add_child(Box::new(SubtreeLoader::new("executor", "dynamic_plan")))
        .add_child(Box::new(SetBlackboard::new(
            "complete",
            "status",
            "completed",
        )));

    // Create execution context
    let mut context = BTreeContext::new().with_llm(llm);

    println!("📋 Starting visualized mission execution...\n");

    // Execute tree
    let result = executor.execute(&mut mission, &mut context).await?;

    println!("\n✅ Mission completed!");
    println!("   Status: {:?}", result.status);
    println!("   Ticks: {}", result.tick_count);
    println!("   Duration: {:?}", result.duration);

    // Export final snapshot
    println!("\n📸 Exporting final visualization state...\n");
    let snapshot = visualizer
        .export_snapshot(&mission, &context, result.tick_count)
        .await?;

    // Display metrics
    println!("📊 Execution Metrics:");
    println!("   Total Ticks: {}", snapshot.metrics.total_ticks);
    println!(
        "   Avg Tick Rate: {:.2} ticks/sec",
        snapshot.metrics.avg_tick_rate
    );
    println!("   Total Replans: {}", snapshot.metrics.total_replans);
    println!(
        "   Failure Rate: {:.2}%",
        snapshot.metrics.failure_rate * 100.0
    );

    // Display execution trace
    println!("\n📜 Execution Trace:");
    for entry in snapshot.execution_trace.iter().take(10) {
        println!(
            "   Tick {}: {} ({:?}) - {:.2}ms",
            entry.tick, entry.node_name, entry.status, entry.duration_ms
        );
    }

    // Display blackboard state
    println!("\n🗂️  Blackboard State:");
    for (key, value) in &snapshot.blackboard {
        println!("   {}: {}", key, value);
    }

    // Export full snapshot to JSON file
    let json = serde_json::to_string_pretty(&snapshot)?;
    std::fs::write("visualization_snapshot.json", &json)?;
    println!("\n💾 Full snapshot saved to: visualization_snapshot.json");

    // Display tree structure
    println!("\n🌳 Tree Structure:");
    print_tree(&snapshot.root, 0);

    println!("\n✨ Visualization demo complete!");
    println!("   Check visualization_snapshot.json for full state export");

    Ok(())
}

fn print_tree(node: &igris_btree::visualizer::NodeSnapshot, indent: usize) {
    let indent_str = "  ".repeat(indent);
    let status_icon = match node.status {
        NodeStatus::Success => "✅",
        NodeStatus::Failure => "❌",
        NodeStatus::Running => "⏳",
        NodeStatus::Skipped => "⏭️",
    };

    println!(
        "{}{} {} ({}) - Ticks: {}",
        indent_str, status_icon, node.name, node.node_type, node.stats.tick_count
    );

    for child in &node.children {
        print_tree(child, indent + 1);
    }
}
