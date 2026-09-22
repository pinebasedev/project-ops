# Provisioning (Alchemy)

`../alchemy.run.ts` + this folder describe the **platform's own** Cloudflare
infrastructure — the control-plane API, the dashboard, their D1 database, and
the Cloudflare Access perimeter (Phase 6, P6-01/02). [Alchemy](https://alchemy.run)
owns build, dev, and deploy for both apps; there is one stage, `prod`.

There is no Cloudflare API token anywhere in this stack or the deployed
control-plane Worker. Alchemy authenticates as itself via `alchemy login`'s
OAuth credentials (cached to `~/.alchemy`, on the deploying machine only) — see
the "Local development" section below and ADR-0009's update.

| File             | Resource                                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| `config.ts`      | `stringOr` — a config value with a dev fallback                                  |
| `Db.ts`          | `control-plane-db` — D1, migrations applied from `apps/control-plane/migrations` |
| `Access.ts`      | reusable Access policies + the GitHub Actions service token (deploy only)        |
| `alchemy.run.ts` | the stack: D1 + control-plane Worker + dashboard, plus Access wiring on deploy   |

## Local development

`pnpm dev` (= `alchemy dev`) runs the whole stack against local simulators:
the control-plane in workerd, a local SQLite D1, and the dashboard on SvelteKit's
vite dev server. Nothing touches the real account — but Alchemy needs a
Cloudflare **identity** to run its providers, so do this once:

```sh
pnpm alchemy login --configure   # OAuth, cached to ~/.alchemy — like `wrangler login`
```

Choose OAuth, then customize the scopes to add `access:write` — Alchemy's
default OAuth scopes already cover Workers/D1, but not Access (needed to manage
`Access.Application` / `Access.Policy` / `Access.ServiceToken`). This one login
is everything a real `alchemy deploy` needs; no API token is minted or pasted
anywhere.

The Access resources are `ALCHEMY_DEV`-guarded (no local simulator exists for
them), so `alchemy dev` needs no Zero Trust org — the control-plane simply runs
ungated locally.

## Not yet proven with a real deploy

`pnpm check:alchemy` typechecks the stack; `alchemy dev` builds the plan and runs
the local resources. The real `alchemy deploy`, the Zero Trust org + Google IdP,
and the end-to-end check (P6-06) are driven by
[`../scripts/phase-6-deploy.sh`](../scripts/phase-6-deploy.sh). Unknowns that only
a real deploy settles:

- **`Website.SvelteKit`** swaps the dashboard's `@sveltejs/adapter-static` for
  Alchemy's in-memory Cloudflare adapter — untested against this app.
- **Base-URL injection** — the dashboard reads `PUBLIC_CONTROL_PLANE_URL` via
  `$env/dynamic/public`; an assets-only SPA inlines that at build time. Under
  `alchemy dev` `controlPlane.url` is the local dev URL and is wired through; on
  deploy it must reach the _build_. If `Website.SvelteKit`'s `env` only reaches
  the runtime, the bundle keeps its `http://localhost:9003` fallback (the
  control-plane's pinned `dev: { port: 9003 }`).
- **`CF_ACCESS_AUD`** is wired from the Access application's `aud` attribute into
  the control-plane Worker's env for server-side JWT verification (P6-03); the
  attribute name is from the Alchemy types, not a live response.
- **Service-token secret** — `serviceTokenClientId` is a stack output; the secret
  is shown once by Cloudflare on create. Both go into demo-project's repo secrets
  (P6-05).
