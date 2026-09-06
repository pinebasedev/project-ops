# Provisioning (Alchemy)

`../alchemy.run.ts` + this folder describe the **platform's own** Cloudflare
infrastructure — the control-plane API, the dashboard, their D1 database, the
Cloudflare Access perimeter, and the control-plane's Secrets Store entry
(Phase 6, P6-01/02/04). [Alchemy](https://alchemy.run) owns build, dev, and
deploy for both apps; there is one stage, `prod`.

| File             | Resource                                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| `config.ts`      | `stringOr` / `redactedOr` — a config value with a dev fallback                   |
| `Db.ts`          | `control-plane-db` — D1, migrations applied from `apps/control-plane/migrations` |
| `Secrets.ts`     | `CLOUDFLARE_API_TOKEN` in the account Secrets Store (deploy only)                |
| `Access.ts`      | reusable Access policies + the GitHub Actions service token (deploy only)        |
| `alchemy.run.ts` | the stack: D1 + control-plane Worker + dashboard, plus Access wiring on deploy   |

## Local development

`pnpm dev` (= `alchemy dev`) runs the whole stack against local simulators:
the control-plane in workerd, a local SQLite D1, and the dashboard on SvelteKit's
vite dev server. Nothing touches the real account — but Alchemy needs a
Cloudflare **identity** to run its providers, so do this once:

```sh
pnpm alchemy login          # OAuth, cached to ~/.alchemy — like `wrangler login`
```

The Access resources and the Secrets Store entry are `ALCHEMY_DEV`-guarded (no
local simulator exists for either), so `alchemy dev` needs no Zero Trust org —
the control-plane runs ungated locally, and `CLOUDFLARE_API_TOKEN` is a plain
binding instead of a store secret. Put real values in a root `.env` if you want
local observability queries to work; otherwise the dev fallbacks apply.

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
- **Secrets Store binding shape** — on deploy the control-plane reads
  `CLOUDFLARE_API_TOKEN` as a `SecretsStoreSecret` (`.get()`); `helpers/secrets.ts`
  handles that and the local plain-string form.
- **`CF_ACCESS_AUD`** is wired from the Access application's `aud` attribute into
  the control-plane Worker's env for server-side JWT verification (P6-03); the
  attribute name is from the Alchemy types, not a live response.
- **Service-token secret** — `serviceTokenClientId` is a stack output; the secret
  is shown once by Cloudflare on create. Both go into demo-project's repo secrets
  (P6-05).
