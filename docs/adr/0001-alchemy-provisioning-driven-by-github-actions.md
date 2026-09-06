# Provision infrastructure with Alchemy, driven from GitHub Actions, using remote Cloudflare-backed state

Status: accepted — extended by [ADR-0009](./0009-platform-self-provisioning-stack.md) for the platform's own infra

We provision all Cloudflare infrastructure (Workers, D1, Durable Objects, KV, etc.) per Project/Environment using Alchemy, executed directly from GitHub Actions workflows in each managed project's own repository — not from the control-plane Worker itself. State is stored via Alchemy's `Cloudflare.state()` (a dedicated state-store Worker + Secrets Store on the Cloudflare account) rather than a local JSON file, since GitHub-hosted runners have no persistent filesystem between runs. We adopt Alchemy's documented stage-naming convention directly: `pr-{number}` for ephemeral PR environments, `staging` and `prod` for the persistent ones.

## Considered Options

Running Alchemy from inside the control-plane Worker was considered so the platform could own provisioning end-to-end, but Workers' CPU/execution-time limits and the lack of a natural place to run long-lived deploy commands ruled that out — GitHub Actions already provides the checkout, secrets, and unrestricted compute this needs. Terraform and Pulumi were also considered, but Alchemy's TypeScript-native, no-codegen typed bindings and its documented PR-stage lifecycle (including a destroy safety guard against tearing down `prod`) match this project's shape closely enough that reimplementing the same thing on a general-purpose IaC tool would have been pure overhead.

## Consequences

Alchemy is pre-1.0 (`v2.0.0-beta.x` at time of writing) — expect API churn and pin an explicit version rather than tracking `latest`.

## Update (2026-09, Phase 6)

Current Alchemy (`2.0.0-beta.76`) turned out to be a fully Effect-based framework that owns build/dev/deploy, not the thin "point at your build output" provisioner this ADR was written against. The decision holds — Alchemy, GitHub-Actions-driven, remote state, `pr-{number}`/`staging`/`prod` stages — but the specifics of the platform provisioning *itself* (one stack; Alchemy owns build/dev/deploy for the control-plane and dashboard; `alchemy dev` as the local workflow) are recorded separately in [ADR-0009](./0009-platform-self-provisioning-stack.md). Managed projects still follow this ADR as written.
