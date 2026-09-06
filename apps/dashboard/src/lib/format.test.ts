import { describe, expect, it } from "vitest";
import {
  environmentTitle,
  integrationTestPresentation,
  shortSha,
  statusPresentation,
} from "./format";

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

describe("integrationTestPresentation", () => {
  it("reports 'not run' when no result has been recorded", () => {
    const p = integrationTestPresentation({
      integrationTestsPassed: null,
      integrationTestsFailed: null,
    });
    expect(p).toMatchObject({ label: "Not run", reported: false, passing: false });
  });

  it("treats an absent count the same as null", () => {
    expect(integrationTestPresentation({}).reported).toBe(false);
  });

  it("summarises an all-passing suite", () => {
    const p = integrationTestPresentation({
      integrationTestsPassed: 12,
      integrationTestsFailed: 0,
    });
    expect(p).toMatchObject({ label: "all 12 passing", reported: true, passing: true });
  });

  it("summarises a failing suite as a fraction of the total", () => {
    const p = integrationTestPresentation({
      integrationTestsPassed: 9,
      integrationTestsFailed: 2,
    });
    expect(p).toMatchObject({ label: "2 of 11 failing", reported: true, passing: false });
  });

  it("singularises a one-test suite", () => {
    expect(
      integrationTestPresentation({ integrationTestsPassed: 1, integrationTestsFailed: 0 }).label,
    ).toBe("1 test passing");
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
