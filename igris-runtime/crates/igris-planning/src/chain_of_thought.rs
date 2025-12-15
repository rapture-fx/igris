/// Chain-of-thought reasoning implementation
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainOfThought {
    pub steps: Vec<String>,
}

impl ChainOfThought {
    pub fn new() -> Self {
        Self { steps: Vec::new() }
    }

    pub fn add_step(&mut self, step: String) {
        self.steps.push(step);
    }
}

impl Default for ChainOfThought {
    fn default() -> Self {
        Self::new()
    }
}
