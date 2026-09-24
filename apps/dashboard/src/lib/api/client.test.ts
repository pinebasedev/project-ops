import { expect, expectTypeOf, it } from "vitest";
import { api } from "./client";

// The RPC client must carry the control-plane's real response shapes (not
// `any`), and must not surface the token hash.
it("exposes the typed control-plane routes", () => {
  expect(typeof api.v1.projects.$get).toBe("function");

  type Projects = Awaited<ReturnType<Awaited<ReturnType<typeof api.v1.projects.$get>>["json"]>>;
  expectTypeOf<Projects>().toBeArray();
  expectTypeOf<Projects[number]>().toHaveProperty("name");
  // The diff link-out (ADR-0007) reads this off the project list.
  expectTypeOf<Projects[number]>().toHaveProperty("githubRepo");
  expectTypeOf<Projects[number]>().not.toHaveProperty("tokenHash");
});
