import { describe, expect, it } from "vitest";
import {
  environmentTitle,
  formatEventTimestamp,
  githubCompareUrl,
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
  it("reports 'not run' when no result has been recorded, and never flags it as failing", () => {
    const p = integrationTestPresentation({
      integrationTestsPassed: null,
      integrationTestsFailed: null,
    });
    expect(p).toMatchObject({ label: "Not run", reported: false, failing: false });
  });

  it("treats an absent count the same as null", () => {
    expect(integrationTestPresentation({}).reported).toBe(false);
  });

  it("summarises an all-passing suite", () => {
    const p = integrationTestPresentation({
      integrationTestsPassed: 12,
      integrationTestsFailed: 0,
    });
    expect(p).toMatchObject({ label: "All 12 passing", reported: true, failing: false });
  });

  it("summarises a failing suite as a fraction of the total", () => {
    const p = integrationTestPresentation({
      integrationTestsPassed: 9,
      integrationTestsFailed: 2,
    });
    expect(p).toMatchObject({ label: "2 of 11 failing", reported: true, failing: true });
  });

  it("singularises a one-test suite", () => {
    expect(
      integrationTestPresentation({ integrationTestsPassed: 1, integrationTestsFailed: 0 }).label,
    ).toBe("1 test passing");
  });
});

describe("githubCompareUrl", () => {
  it("builds a compare URL from a repo slug and two SHAs", () => {
    expect(githubCompareUrl("pinebase/demo-project", "aaa111", "bbb222")).toBe(
      "https://github.com/pinebase/demo-project/compare/aaa111...bbb222",
    );
  });

  it("returns null when the project has no repo slug", () => {
    expect(githubCompareUrl(null, "aaa111", "bbb222")).toBeNull();
    expect(githubCompareUrl(undefined, "aaa111", "bbb222")).toBeNull();
    expect(githubCompareUrl("  ", "aaa111", "bbb222")).toBeNull();
  });

  it("returns null when either SHA is missing", () => {
    expect(githubCompareUrl("pinebase/demo-project", null, "bbb222")).toBeNull();
    expect(githubCompareUrl("pinebase/demo-project", "aaa111", undefined)).toBeNull();
  });

  it("returns null when both SHAs are the same — there is nothing to compare", () => {
    expect(githubCompareUrl("pinebase/demo-project", "aaa111", "aaa111")).toBeNull();
  });
});

describe("formatEventTimestamp", () => {
  it("renders an ISO timestamp as a fixed UTC string", () => {
    expect(formatEventTimestamp("2026-01-02T01:00:00.000Z")).toBe("2026-01-02 01:00:00 UTC");
  });

  it("returns the input unchanged when it doesn't parse", () => {
    expect(formatEventTimestamp("not-a-date")).toBe("not-a-date");
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
