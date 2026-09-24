export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message.includes("UNIQUE constraint failed")) return true;
  return error.cause instanceof Error && error.cause.message.includes("UNIQUE constraint failed");
}
