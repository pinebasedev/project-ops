import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { stringOr } from "./config.ts";

/**
 * Cloudflare Access resources for the platform (ADR-0005, P6-02).
 *
 *   - `allowTeam`  — interactive login for the **dashboard**: the founder only,
 *     via the Google IdP configured in the Zero Trust org.
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
  // Who may log in to the dashboard. Defaults to the founder; a self-hoster
  // overrides it via CF_ACCESS_ALLOW_EMAIL without touching this file (ADR-0005).
  const allowEmail = yield* stringOr("CF_ACCESS_ALLOW_EMAIL", "oros.stefan18@gmail.com");

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
