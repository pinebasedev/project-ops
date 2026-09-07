import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger, serializeError } from "../../src/helpers/logger";

afterEach(() => {
  vi.restoreAllMocks();
});

type Line = Record<string, unknown>;

// The first argument of each recorded console call — the structured line.
function lines(spy: { mock: { calls: unknown[][] } }): Line[] {
  return spy.mock.calls.map((call) => call[0] as Line);
}

describe("createLogger", () => {
  it("emits one structured object per call, not a formatted string", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger().info("request", { status: 200 });

    expect(log).toHaveBeenCalledTimes(1);
    const line = lines(log)[0]!;
    expect(line).toMatchObject({ level: "info", message: "request", status: 200 });
    expect(typeof line.time).toBe("string");
  });

  it("merges bound fields into every line", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger({ requestId: "req-1" }).info("a");
    createLogger({ requestId: "req-1" }).debug("b");

    expect(lines(log)[0]!).toMatchObject({ requestId: "req-1", message: "a" });
    expect(lines(log)[1]!).toMatchObject({ requestId: "req-1", level: "debug" });
  });

  it("routes warn and error through console.error, info and debug through console.log", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger();

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(log).toHaveBeenCalledTimes(2);
    expect(err).toHaveBeenCalledTimes(2);
  });

  it("flattens an Error passed as a field so it survives serialization", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    createLogger().error("boom", { err: new TypeError("bad input") });

    const serialized = lines(err)[0]!.err as Record<string, unknown>;
    expect(serialized).toMatchObject({ name: "TypeError", message: "bad input" });
    expect(typeof serialized.stack).toBe("string");
  });

  it("with() derives a logger carrying the extra fields", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger({ requestId: "req-1" }).with({ projectId: "proj-1" }).info("scoped");

    expect(lines(log)[0]!).toMatchObject({ requestId: "req-1", projectId: "proj-1" });
  });
});

describe("serializeError", () => {
  it("unwraps name, message, stack, and a nested cause", () => {
    const root = new Error("root cause");
    const wrapped = new Error("wrapped", { cause: root });

    expect(serializeError(wrapped)).toMatchObject({
      name: "Error",
      message: "wrapped",
      cause: { message: "root cause" },
    });
  });

  it("stringifies a non-Error throw", () => {
    expect(serializeError("just a string")).toEqual({ value: "just a string" });
  });
});
