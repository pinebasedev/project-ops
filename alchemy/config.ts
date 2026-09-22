import * as Config from "effect/Config";

/**
 * Deploy-time config values with a dev fallback, so `alchemy dev` and
 * `check:alchemy` run without a populated `.env`. Mirrors demo-project's
 * `devSecret` helper (`../demo-project/alchemy/Api.ts`).
 */
export const stringOr = (name: string, fallback: string): Config.Config<string> =>
  Config.string(name).pipe(Config.withDefault(fallback));
