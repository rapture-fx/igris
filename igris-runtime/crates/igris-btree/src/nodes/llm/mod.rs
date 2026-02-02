//! LLM-powered nodes for adaptive behavior.
//!
//! This module contains nodes that use Large Language Models to generate and
//! execute behavior dynamically. These nodes enable the behavior tree to adapt
//! to situations that weren't explicitly programmed.
//!
//! # Components
//!
//! - [`LLMPlannerNode`]: Generate behavior tree plans via LLM
//! - [`SubtreeLoader`]: Load and execute dynamically generated plans
//!
//! # BYOM Philosophy
//!
//! All LLM nodes follow the **Bring Your Own Model (BYOM)** philosophy:
//! - No vendor lock-in or hosted services
//! - Customers implement the [`LlmProvider`](crate::LlmProvider) trait
//! - Full control over inference, cost, and latency
//! - Works with local models or cloud APIs (customer's choice)
//!
//! # Architecture
//!
//! ```text
//! ┌──────────────────────────────────────┐
//! │  LLMPlannerNode                      │
//! │  1. Read task from blackboard        │
//! │  2. Construct prompt with tools      │
//! │  3. Call LLM via LlmProvider         │
//! │  4. Parse JSON response              │
//! │  5. Store plan in blackboard         │
//! └──────────────────────────────────────┘
//!            ▼ (plan stored as JSON)
//! ┌──────────────────────────────────────┐
//! │  SubtreeLoader                       │
//! │  1. Read plan from blackboard        │
//! │  2. Parse JSON with JsonTreeParser   │
//! │  3. Execute loaded subtree           │
//! │  4. Cache for subsequent ticks       │
//! └──────────────────────────────────────┘
//! ```
//!
//! # Workflow
//!
//! ## 1. Planning Phase
//!
//! `LLMPlannerNode` generates a behavior tree plan:
//! 1. Reads task description from blackboard
//! 2. Constructs prompt with available tools and BTree schema
//! 3. Calls customer's `LlmProvider` implementation
//! 4. Parses JSON response (with retry on failure)
//! 5. Stores plan in blackboard under specified key
//!
//! ## 2. Execution Phase
//!
//! `SubtreeLoader` loads and executes the plan:
//! 1. Reads plan JSON from blackboard
//! 2. Parses JSON into executable nodes via `JsonTreeParser`
//! 3. Ticks the loaded subtree
//! 4. Caches the subtree for subsequent ticks
//!
//! ## 3. Adaptive Replanning
//!
//! `ReplanOnFailure` decorator combines both:
//! 1. Executes child node
//! 2. On failure, triggers `LLMPlannerNode` to generate new plan
//! 3. Loads new plan via `SubtreeLoader`
//! 4. Retries with new plan (up to max replans)
//!
//! # Examples
//!
//! ## Basic LLM Planning
//!
//! ```no_run
//! use igris_btree::prelude::*;
//! use igris_btree::MockLlmProvider;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let provider = Arc::new(MockLlmProvider::with_navigation_plan());
//! let mut context = BTreeContext::new().with_llm(provider);
//!
//! // Set task
//! context.blackboard.set("mission", serde_json::json!("Navigate to warehouse")).await;
//!
//! // Generate plan
//! let mut planner = LLMPlannerNode::new("planner", "mission", "plan");
//! let status = planner.tick(&mut context).await?;
//!
//! assert_eq!(status, NodeStatus::Success);
//! assert!(context.blackboard.contains("plan").await);
//! # Ok(())
//! # }
//! ```
//!
//! ## Load and Execute Plan
//!
//! ```no_run
//! use igris_btree::prelude::*;
//! use igris_btree::MockLlmProvider;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! # let provider = Arc::new(MockLlmProvider::with_navigation_plan());
//! # let mut context = BTreeContext::new().with_llm(provider);
//! # context.blackboard.set("mission", serde_json::json!("Navigate")).await;
//! # let mut planner = LLMPlannerNode::new("planner", "mission", "plan");
//! # planner.tick(&mut context).await?;
//! // (Assume plan is in blackboard from previous example)
//!
//! // Load and execute
//! let mut loader = SubtreeLoader::new("executor", "plan");
//! let status = loader.tick(&mut context).await?;
//! # Ok(())
//! # }
//! ```
//!
//! ## Full Hybrid Tree
//!
//! ```no_run
//! use igris_btree::prelude::*;
//! use igris_btree::MockLlmProvider;
//!
//! # #[tokio::main]
//! # async fn main() -> anyhow::Result<()> {
//! let provider = Arc::new(MockLlmProvider::with_navigation_plan());
//! let mut context = BTreeContext::new().with_llm(provider);
//!
//! // Hybrid tree: deterministic wrapper + LLM-generated content
//! let mut tree = Sequence::new("hybrid_mission")
//!     .add_child(Box::new(SetBlackboard::new("init", "task", "Navigate to warehouse")))
//!     .add_child(Box::new(LLMPlannerNode::new("plan", "task", "subtree_plan")))
//!     .add_child(Box::new(SubtreeLoader::new("execute", "subtree_plan")))
//!     .add_child(Box::new(SetBlackboard::new("done", "status", "complete")));
//!
//! let status = tree.tick(&mut context).await?;
//! # Ok(())
//! # }
//! ```

mod llm_planner;
mod subtree_loader;

pub use llm_planner::LLMPlannerNode;
pub use subtree_loader::SubtreeLoader;
