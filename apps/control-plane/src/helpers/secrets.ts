// A binding that carries a secret value can arrive two ways: a plain string
// (local `.dev.vars`) or a Cloudflare Secrets Store binding whose value is read
// at runtime with `.get()` (deployed — the control-plane's `CLOUDFLARE_API_TOKEN`
// lives in Secrets Store per ADR-0005 / P6-04). `resolveSecret` flattens both to
// a string, treating empty as absent.
//
// Structural, not `@cloudflare/workers-types`' `SecretsStoreSecret`: `env.ts`
// flows into the dashboard's typed RPC client, whose tsconfig doesn't load the
// Workers globals — the `.get()` shape is all this needs.
export type SecretsStoreBinding = { get(): Promise<string> };
export type MaybeSecret = string | SecretsStoreBinding | undefined;

export async function resolveSecret(value: MaybeSecret): Promise<string | undefined> {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value || undefined;
  const resolved = await value.get();
  return resolved || undefined;
}
