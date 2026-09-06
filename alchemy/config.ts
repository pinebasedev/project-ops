import * as Config from "effect/Config";
import * as Redacted from "effect/Redacted";

/**
 * Deploy-time config values with a dev fallback, so `alchemy dev` and
 * `check:alchemy` run without a populated `.env`. Mirrors demo-project's
 * `devSecret` helper (`../demo-project/alchemy/Api.ts`).
 */
export const stringOr = (name: string, fallback: string): Config.Config<string> =>
  Config.string(name).pipe(Config.withDefault(fallback));

export const redactedOr = (
  name: string,
  fallback: string,
): Config.Config<Redacted.Redacted<string>> =>
  Config.redacted(name).pipe(Config.withDefault(Redacted.make(fallback)));
