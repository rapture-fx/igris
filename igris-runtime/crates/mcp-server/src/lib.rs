pub mod protocol;
pub mod handlers;
pub mod context;
pub mod discovery;
pub mod multicast;
pub mod storage;
pub mod signing;

pub use protocol::{JsonRpcRequest, JsonRpcResponse, JsonRpcError, McpCapabilities, ToolCallParams, ToolCallResult, ToolResultContent, SignedExecutionEnvelope};
pub use handlers::{build_mcp_router, McpState};
pub use context::{SharedContext, ContextStore};
pub use discovery::PeerDiscovery;
pub use multicast::MulticastDiscovery;
pub use storage::EncryptedStorage;
pub use signing::ExecutionSigner;
