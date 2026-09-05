# Integration tests run once, on staging after merge — not per PR

Status: accepted

The Integration Test suite runs a single time per merge, against the `staging` Environment, right after a PR merges into the `staging` branch and triggers its redeploy. It does not run against ephemeral PR Environments. PR Environments are still provisioned and deployed on every push (for the preview URL and manual review), and still gated by unit tests — they just don't get a live Integration Test run on every commit.

## Considered Options

Running Integration Tests on every PR push was the original plan, and it's what would let the dashboard answer "which integration tests failed for this PR" literally, per PR, before merge. It was rejected because a PR iterated on with many pushes would trigger a live integration run (real Alchemy-provisioned infra, real requests) on every single push — wasteful for a suite meant to cover the most important features, not exhaustive coverage. Running once per merge, against staging, cuts that to one run per landed change.

## Consequences

Integration failures are now caught **after** a PR has already merged into `staging`, not before — recovery is a revert or fix-forward, not a blocked merge. The target question "which integration tests failed for this PR?" is answered via the staging Deployment that resulted from merging it, not a dedicated per-PR run. Because promotion (`staging` → `main`) is a plain git merge with no automated test gate (ADR-0002), the dashboard surfacing staging's current Integration Test status is what actually prevents someone from promoting a broken state — this makes that dashboard signal load-bearing, not cosmetic.
