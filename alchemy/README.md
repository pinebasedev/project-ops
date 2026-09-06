# Provisioning (Alchemy)

`../alchemy.run.ts` + this folder describe the **platform's own** Cloudflare
infrastructure — the control-plane API, the dashboard, their D1 database, the
Cloudflare Access perimeter, and the control-plane's Secrets Store entry
(Phase 6, P6-01/02/04). [Alchemy](https://alchemy.run) owns the deploy; there is
one stage, `prod`.

| File             | Resource                                                                          |
| ---------------- | --------------------------------------------------------------------------------- |
| `Db.ts`          | `control-plane-db` — D1, migrations applied from `apps/control-plane/migrations`  |
| `Secrets.ts`     | `CLOUDFLARE_API_TOKEN` in the account Secrets Store, bound into the control-plane |
| `Access.ts`      | reusable Access policies + the GitHub Actions service token (ADR-0005)            |
| `alchemy.run.ts` | the stack: D1 + control-plane Worker + dashboard + the Access application         |

## Local development is **not** Alchemy

Unlike demo-project, the control-plane keeps `@cloudflare/vite-plugin` +
`wrangler.jsonc` for local work (`pnpm --filter control-plane dev`), and the
dashboard keeps `vite dev`. Reason: this stack declares Cloudflare Access
resources, and Alchemy plans those against the real Zero Trust API even under
`alchemy dev` — so `alchemy dev` can't run without a connected account. Alchemy
here is deploy-only. See ADR-0009.

## Not yet proven with a real deploy

`pnpm check:alchemy` (typecheck) passes and `alchemy dev` parses the stack and
builds the plan up to the first Access resource. The real
`alchemy deploy`, the Zero Trust org + Google IdP, and the end-to-end check
(P6-06) are driven by [`../scripts/phase-6-deploy.sh`](../scripts/phase-6-deploy.sh).
Unknowns that only a real deploy settles:

- **`Website.SvelteKit`** swaps the dashboard's `@sveltejs/adapter-static` for
  Alchemy's in-memory Cloudflare adapter — untested against this app.
- **Secrets Store binding shape** — the control-plane reads
  `CLOUDFLARE_API_TOKEN` as a plain string locally and expects a
  `SecretsStoreSecret` (`.get()`) when deployed (`helpers/secrets.ts` handles
  both).
- **`CF_ACCESS_AUD`** is wired from the Access application's `aud` attribute
  into the control-plane Worker's env for server-side JWT verification (P6-03);
  the attribute name is from the Alchemy types, not a live response.
- **Service-token secret** — `serviceTokenClientId` is a stack output; the
  secret is shown once by Cloudflare on create. Both go into demo-project's repo
  secrets (P6-05).
