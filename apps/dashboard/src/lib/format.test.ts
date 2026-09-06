import { describe, expect, it } from "vitest";
import { environmentTitle, shortSha, statusPresentation } from "./format";

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

describe("environmentTitle", () => {
  it("uses the PR number when the latest deployment has one", () => {
    expect(environmentTitle({ stageName: "pr-42" }, { prNumber: 42 })).toBe("PR #42");
  });

  it("falls back to the stage name without a deployment or PR number", () => {
    expect(environmentTitle({ stageName: "pr-42" }, null)).toBe("pr-42");
    expect(environmentTitle({ stageName: "staging" }, { prNumber: null })).toBe("staging");
  });
});
