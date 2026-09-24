# Provisioning (Alchemy)

`../alchemy.run.ts` + this folder describe the **platform's own** Cloudflare
infrastructure: one SvelteKit Worker serving the dashboard and, mounted
same-origin at `/v1/*`, the control-plane API; its D1 database; and the
Cloudflare Access perimeter. [Alchemy](https://alchemy.run) owns build, dev, and
deploy for it; there is one stage, `prod`. See
[ADR-0009](../docs/adr/0009-platform-self-provisioning-stack.md).

There is no Cloudflare API token anywhere in this stack or the deployed Worker.
Alchemy authenticates as itself via its Cloudflare profile's OAuth credentials,
cached to `~/.alchemy` on the deploying machine only
([ADR-0012](../docs/adr/0012-no-platform-cloudflare-api-credential.md)).

| File             | Resource                                                                            |
| ---------------- | ----------------------------------------------------------------------------------- |
| `config.ts`      | `stringOr` — a config value with a dev fallback                                     |
| `Db.ts`          | `production-project-ops-db` — D1, migrations applied from `apps/api/migrations`     |
| `Access.ts`      | the Access policies (`allow-team`, `allow-ci`) and the GitHub Actions service token |
| `alchemy.run.ts` | the stack: D1 + the dashboard/control-plane Worker, plus the Access application     |

## Connecting Alchemy to Cloudflare (once)

Both `alchemy dev` and `alchemy deploy` need a Cloudflare identity:

```sh
pnpm alchemy profile edit --add Cloudflare   # OAuth, cached to ~/.alchemy — like `wrangler login`
```

Choose OAuth, then customize the scopes to add `access:write`. Alchemy's default
scopes cover Workers and D1, but not Access. Already connected but missing a
scope (e.g. after an Alchemy upgrade)?
`pnpm alchemy profile refresh --profile default --provider Cloudflare`
re-prompts for scopes without disconnecting anything.

## Local development

`pnpm dev` (= `alchemy dev`) runs the whole app against local simulators: a
local SQLite D1 and SvelteKit's Vite dev server, with the control-plane routes
served from the same process. Nothing touches the real account.

The Access resources are `ALCHEMY_DEV`-guarded (no local simulator exists for
them), so local dev needs no Zero Trust org and the control-plane runs ungated.

## Deploying

`pnpm check:alchemy` typechecks the stack. A real deploy needs a Zero Trust org
with a Google identity provider, and the Access values in the root `.env`
(`CF_ACCESS_TEAM_DOMAIN`, `CF_GOOGLE_IDP_ID`, `CF_ACCESS_ALLOW_EMAIL`, see
`../.env.example`). `alchemy deploy` fails if any of the three is missing. [`../scripts/deploy-wizard.sh`](../scripts/deploy-wizard.sh) walks you
through all of it.

The stack outputs `dashboardUrl`, the Access application's `accessAud`, and the
service token's `serviceTokenClientId`. Cloudflare shows the service token's
secret only once, on creation. A managed project's CI needs the client ID and
secret as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` repo secrets.
