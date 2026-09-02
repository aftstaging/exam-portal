export function getAttemptProgress(status: string, currentSection: number): number {
  if (status === "submitted" || status === "awaiting_marking" || status === "marked") return 100;
  if (status !== "in_progress") return 0;
  return Math.min(99, Math.max(1, currentSection * 25));
}

export function humanizeStatus(status: string): string {
  return status.replace(/_/g, " ");
}
