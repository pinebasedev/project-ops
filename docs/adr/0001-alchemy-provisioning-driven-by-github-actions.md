# Provision infrastructure with Alchemy, driven from GitHub Actions, using remote Cloudflare-backed state

Status: accepted — extended by [ADR-0009](./0009-platform-self-provisioning-stack.md) for the platform's own infra

We provision all Cloudflare infrastructure (Workers, D1, Durable Objects, KV, etc.) per Project/Environment using Alchemy, executed directly from GitHub Actions workflows in each managed project's own repository — not from the control-plane Worker itself. State is stored via Alchemy's `Cloudflare.state()` (a dedicated state-store Worker + Secrets Store on the Cloudflare account) rather than a local JSON file, since GitHub-hosted runners have no persistent filesystem between runs. We adopt Alchemy's documented stage-naming convention directly: `pr-{number}` for ephemeral PR environments, `staging` and `prod` for the persistent ones.

## Considered Options

Running Alchemy from inside the control-plane Worker was considered so the platform could own provisioning end-to-end, but Workers' CPU/execution-time limits and the lack of a natural place to run long-lived deploy commands ruled that out — GitHub Actions already provides the checkout, secrets, and unrestricted compute this needs. Terraform and Pulumi were also considered, but Alchemy's TypeScript-native, no-codegen typed bindings and its documented PR-stage lifecycle (including a destroy safety guard against tearing down `prod`) match this project's shape closely enough that reimplementing the same thing on a general-purpose IaC tool would have been pure overhead.

## Consequences

Alchemy is pre-1.0 (`v2.0.0-beta.x` at time of writing) — expect API churn and pin an explicit version rather than tracking `latest`.

## Update (2026-09, Phase 6)

Current Alchemy (`2.0.0-beta.76`) turned out to be a fully Effect-based framework that owns build/dev/deploy, not the thin "point at your build output" provisioner this ADR was written against. The decision holds — Alchemy, GitHub-Actions-driven, remote state, `pr-{number}`/`staging`/`prod` stages — but the specifics of the platform provisioning *itself* (one stack; Alchemy owns build/dev/deploy for the control-plane and dashboard; `alchemy dev` as the local workflow) are recorded separately in [ADR-0009](./0009-platform-self-provisioning-stack.md). Managed projects still follow this ADR as written.

## Update (2026-09, credential provisioning)

This ADR never actually said how a managed project's `CLOUDFLARE_API_TOKEN` gets into its repo secrets in the first place — P6-06's `scripts/phase-6-deploy.sh` filled that gap ad hoc: a human creates a Custom Token by hand in the Cloudflare dashboard, pastes it into a wizard prompt, which then shells out to `gh secret set`. That's a manual step whose Cloudflare API permissions happen to only be checkable by re-reading the wizard's own `note`/`warn` lines, not reviewable in a diff, and not something a compromised or rotated token can be reprovisioned from without a human repeating the dashboard click-through.

That gap existed because the `/wizard` skill's own scope is *steps only a human can perform* (OAuth flows, dashboard-only actions like standing up a Zero Trust org) — and "go create an API token" was bucketed there by surface resemblance to those, without checking whether Alchemy already had a code path for it. It does: `Cloudflare.ApiToken.AccountApiToken` mints an account-owned token via `POST /accounts/{id}/tokens` (Cloudflare reveals the value once; Alchemy persists it to state), and `GitHub.Secret` pushes a value straight into a repo's encrypted secrets — the pattern Alchemy's own CI/CD guide recommends (a one-time `stacks/github.ts`, run once from a human's machine, never from CI itself).

**Decision:** each managed project's Cloudflare CI credential is provisioned by a small, one-time Alchemy stack (e.g. `alchemy/github.ts` in the managed project), not by a human copying a value out of the Cloudflare dashboard. That stack:
- Mints an `AccountApiToken` scoped to only the permission groups that project's own stack actually uses (for demo-project: `Workers Scripts Write`, `D1 Write`, `Workers R2 Storage Write` — never Access, Secrets Store, or Org/IdP/Groups, which are platform-only concerns per [ADR-0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md)).
- Pushes the minted value directly into that project's `CLOUDFLARE_API_TOKEN` repo secret via `GitHub.Secret` — no value is ever printed to a terminal or typed into a wizard prompt.
- Is run once by hand (`alchemy deploy` against this small stack, same "once, not from CI" shape as `alchemy login`), and is re-runnable to rotate the token without touching the Cloudflare dashboard at all.

This doesn't change the underlying ceiling noted elsewhere: Cloudflare's permission groups are still account-wide (`resources: { ...account...: "*" }`), not scoped to a specific D1 database or R2 bucket — Alchemy's own advertised pattern hits the same limit. What changes is that the credential is now minted narrowly-by-permission-group, in code, reviewable in a PR, and reproducible — instead of manually, broadly-scoped-by-habit, and shared only through a wizard transcript.

## Consequences (update)

`scripts/phase-6-deploy.sh` shrinks to only the steps that are irreducibly human: `alchemy login`'s OAuth flow, creating the Zero Trust org, and configuring the Google IdP's OAuth client (all dashboard/browser-only, no API for the org-creation step). Token minting, GitHub secret-setting, and — per the corresponding note in [ADR-0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md) — the Access service-token credentials move out of the wizard and into stacks. Not yet implemented; tracked as a follow-up to P6-06.
