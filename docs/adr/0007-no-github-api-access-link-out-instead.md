# Control plane never calls GitHub's API — link out instead of fetching

Status: accepted

The control plane holds no GitHub API credentials (no PAT, no GitHub App) and never calls GitHub's API for anything. Two places where this could easily have crept in were decided against explicitly:

- **Deployment diffs**: `Deployment` stores only a commit SHA. "What changed between two deployments" is answered by linking to GitHub's own compare view (`github.com/{owner}/{repo}/compare/{sha1}...{sha2}`), not by fetching or storing a changed-files list.
- **Integration test detail**: the control plane stores only an aggregate pass/fail count per Deployment (pushed by the GitHub Actions workflow, from the test runner's own exit summary) plus a link to the Actions run. It does not store per-test names/outcomes, and does not fetch or scrape the Actions run's logs to reconstruct them.

## Considered Options

Storing structured per-test results (parsed from the test runner's JSON reporter output and pushed alongside the rest of the deployment callback) was considered and is a small amount of work — but was dropped for consistency with the diff decision, and because the alternative (the control plane pulling GitHub Actions logs to reconstruct test detail after the fact) is both fragile (unstructured log text, breaks if the test runner's console format changes, subject to GitHub's ~90-day log retention) and reopens exactly the GitHub-API-credentials surface this decision avoids.

## Consequences

"Which integration tests failed for this PR?" is answered as "N of M failed, see the Actions run" rather than a per-test-name list directly queryable through the dashboard or MCP. GitHub's own UI is the source of truth for diffs and per-test detail; the control plane's job stays limited to correlating *that something happened* (status, counts, links) across commit → CI run → deployment → environment, not duplicating data GitHub already serves well.
