import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

/**
 * Cloudflare Access resources for the platform (ADR-0005, P6-02).
 *
 *   - `allowTeam`  — interactive login for the **dashboard**: the single
 *     allow-listed operator email, via the Google IdP configured in the Zero
 *     Trust org.
 *   - `serviceToken` + `allowCi` — machine-to-machine access to the
 *     **control-plane API** for managed projects' GitHub Actions. The token's
 *     `clientId` / `clientSecret` become `CF_ACCESS_CLIENT_ID` /
 *     `CF_ACCESS_CLIENT_SECRET` repo secrets on each managed project (P6-05).
 *
 * The Application itself is declared where the Worker is (`alchemy.run.ts`,
 * via its `access` prop / an explicit `Access.Application` — see ADR-0009's
 * merge update, one Worker now, not two), so these are just the reusable
 * policies plus the token.
 */
export const accessResources = Effect.gen(function* () {
  // Who may log in to the dashboard (ADR-0005). Required, with no default:
  // these resources only exist on deploy, and a baked-in fallback would grant
  // that address login to every deployment that forgot to set it.
  const allowEmail = yield* Config.String("CF_ACCESS_ALLOW_EMAIL");

  const serviceToken = yield* Cloudflare.Access.ServiceToken("github-actions", {
    name: "cloudflare-idp-github-actions",
  });

  const allowTeam = yield* Cloudflare.Access.Policy("allow-team", {
    name: "cloudflare-idp dashboard — allow-list",
    decision: "allow",
    include: [{ email: allowEmail }],
  });

  const allowCi = yield* Cloudflare.Access.Policy("allow-ci", {
    name: "cloudflare-idp control-plane — CI service token",
    decision: "non_identity",
    include: [{ serviceToken: serviceToken.serviceTokenId }],
  });

  return { serviceToken, allowTeam, allowCi };
});
