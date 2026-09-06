import { describe, expect, it } from "vitest";
import { shortSha, statusPresentation } from "./format";

describe("shortSha", () => {
  it("truncates a full commit SHA to 7 characters", () => {
    expect(shortSha("1a2b3c4d5e6f7a8b9c0d")).toBe("1a2b3c4");
  });

  it("leaves an already-short SHA untouched", () => {
    expect(shortSha("abc123")).toBe("abc123");
  });
});

describe("statusPresentation", () => {
  it("maps each known deployment status to a label", () => {
    expect(statusPresentation("in_progress").label).toBe("In progress");
    expect(statusPresentation("done").label).toBe("Done");
    expect(statusPresentation("failed").label).toBe("Failed");
  });

  it("represents a missing deployment distinctly", () => {
    expect(statusPresentation(undefined).label).toBe("No deployments");
  });

  it("falls back for an unrecognized status rather than throwing", () => {
    expect(statusPresentation("weird").label).toBe("weird");
  });
});
