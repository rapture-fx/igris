pub mod context;
pub mod discovery;
pub mod handlers;
pub mod multicast;
pub mod protocol;
pub mod signing;
pub mod storage;

pub use context::{ContextStore, SharedContext};
pub use discovery::PeerDiscovery;
pub use handlers::{build_mcp_router, McpState};
pub use multicast::MulticastDiscovery;
pub use protocol::{
    JsonRpcError, JsonRpcRequest, JsonRpcResponse, McpCapabilities, SignedExecutionEnvelope,
    ToolCallParams, ToolCallResult, ToolResultContent,
};
pub use signing::ExecutionSigner;
pub use storage::EncryptedStorage;
