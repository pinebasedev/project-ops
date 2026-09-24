# No dedicated AI/agent interface in this version

Status: accepted
Date: 2026-09-05

The original project goals named "a useful AI/agent interface" as one of the things this platform should demonstrate, and asked for a comparison between a dashboard chat (Workers AI) and an MCP server before assuming either was right. That comparison settled on a read-only MCP server for a developer using Claude Code locally — but it's been dropped, with no replacement, for this version.

The control-plane API is already a plain, read-only REST API — the same one the dashboard and GitHub Actions use. Any HTTP-capable coding agent can call it directly once it has an Access-authenticated session, without a bespoke MCP server as a middle layer. A dedicated MCP server added real implementation surface (a whole extra service, tool-schema definitions to design and maintain) for marginal benefit over that direct access, given the read-only scope already settled on.

## Consequences

"A useful AI/agent interface" from the original goals is explicitly **deferred, not fulfilled implicitly** — a coding agent can reach the data, but there's no purpose-built interaction surface for it, and that gap is a known, deliberate gap rather than an oversight. Revisit if a concrete reason for a dedicated surface shows up: e.g. write/operate tools (not just reads) where a typed, discoverable tool interface starts mattering more than raw API access, or a chat UI if a non-technical audience needs one.
