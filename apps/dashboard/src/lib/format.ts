const SHORT_SHA_LENGTH = 7;

export function shortSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH);
}

export type StatusPresentation = {
  label: string;
  /** Tailwind classes for a small status pill. */
  badgeClass: string;
};

const KNOWN_STATUSES: Record<string, StatusPresentation> = {
  in_progress: {
    label: "In progress",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  done: {
    label: "Done",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
};

const NEUTRAL_BADGE = "bg-muted text-muted-foreground";
const NO_DEPLOYMENT: StatusPresentation = { label: "No deployments", badgeClass: NEUTRAL_BADGE };

// `status` is a plain string (not the DeploymentStatus union) because it arrives
// off the wire — an unknown value is shown verbatim rather than crashing a view.
export function statusPresentation(status: string | undefined | null): StatusPresentation {
  if (!status) return NO_DEPLOYMENT;
  return KNOWN_STATUSES[status] ?? { label: status, badgeClass: NEUTRAL_BADGE };
}

export type IntegrationTestPresentation = StatusPresentation & {
  /** True once a result has been reported — lets the view show it prominently. */
  reported: boolean;
  /** True only when a result is reported and at least one test failed. This is
   * the load-bearing "don't promote" signal (ADR-0006) — never true for a
   * not-yet-reported result, so the view doesn't cry wolf on a fresh redeploy. */
  failing: boolean;
};

/**
 * How to summarise a Deployment's aggregate Integration Test outcome. The
 * control plane stores counts only, not per-test detail (ADR-0007), so this is
 * "N of M failing" / "All M passing" / "Not run" plus a pill colour.
 * `passed`/`failed` are read off the wire and may be null (never run) or, in
 * theory, absent — treated the same as "not reported".
 */
export function integrationTestPresentation(deployment: {
  integrationTestsPassed?: number | null;
  integrationTestsFailed?: number | null;
}): IntegrationTestPresentation {
  const passed = deployment.integrationTestsPassed;
  const failed = deployment.integrationTestsFailed;

  if (passed == null || failed == null) {
    return { label: "Not run", badgeClass: NEUTRAL_BADGE, reported: false, failing: false };
  }

  const total = passed + failed;
  if (failed > 0) {
    return {
      label: `${failed} of ${total} failing`,
      badgeClass: KNOWN_STATUSES.failed.badgeClass,
      reported: true,
      failing: true,
    };
  }
  return {
    label: total === 1 ? "1 test passing" : `All ${total} passing`,
    badgeClass: KNOWN_STATUSES.done.badgeClass,
    reported: true,
    failing: false,
  };
}

/**
 * How to title an environment in the UI: its PR number when a deployment has
 * recorded one, otherwise the Alchemy stage name as a fallback.
 */
export function environmentTitle(
  environment: { stageName: string },
  deployment: { prNumber?: number | null } | null | undefined,
): string {
  return deployment?.prNumber != null ? `PR #${deployment.prNumber}` : environment.stageName;
}
