# Promotion to production is a Git merge, not a control-plane action

Status: accepted

Staging deploys automatically whenever a feature PR merges into the `staging` branch; production deploys automatically whenever `staging` merges into `main`. The control plane never initiates or gates a promotion — it only observes the resulting GitHub Actions run and records the Deployment.

We chose this over a dashboard "Promote" button so the platform's audit trail is just Git history (who merged what, when, reviewed how), rather than a second, parallel promotion log the control plane would have to keep consistent with Git.
