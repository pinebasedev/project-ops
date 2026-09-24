import * as Config from "effect/Config";

/**
 * Deploy-time config values with a dev fallback, so `alchemy dev` and
 * `check:alchemy` run without a populated `.env`.
 */
export const stringOr = (name: string, fallback: string): Config.Config<string> =>
  Config.String(name).pipe(Config.withDefault(fallback));
