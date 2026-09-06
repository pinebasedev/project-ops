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
