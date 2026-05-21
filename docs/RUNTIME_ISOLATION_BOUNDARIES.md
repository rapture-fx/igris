# Runtime Isolation Boundaries

Each task records the boundary Overture expected for the runtime action:
environment label, allowed tools, denied tools, network/file/API scope, resource
limits, and runtime capabilities when available.

Boundary records are evidence and policy inputs. Overture does not blindly trust
runtime claims; runtime-submitted proof is still validated server-side.

Boundary violations are persisted separately from receipts so operators can see
when a runtime exceeded or reported exceeded limits.

Production-ready: safe boundary summaries and violation records.

Experimental: enforcement depends on runtime support for the declared isolation
capability.
