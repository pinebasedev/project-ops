# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability): open this repository's **Security** tab and choose **Report a vulnerability**. Don't open a public issue.

Include what's affected, how to reproduce it, and the impact you expect. You can expect an acknowledgement within a week. This is a single-maintainer project, so fixes are best-effort.

## Supported versions

Only the latest release and the latest commit on `main` are supported. There are no release branches.

## Scope

Of particular interest:

- Bypassing the Cloudflare Access perimeter or the Worker's server-side Access JWT check.
- A service-token (CI) caller reading data through `/v1/*` routes that should require an identity login.
- One managed project's bearer token writing another project's Deployments.
- Secrets (bearer tokens, Access credentials, JWTs) leaking into logs, error responses, or Actions output.

Vulnerabilities in dependencies (Alchemy, Hono, SvelteKit, Cloudflare's platform) should go to those projects, unless the way this repository uses them is the problem.
