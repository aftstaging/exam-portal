import type { Request, Response } from "express";
import { sdk } from "./sdk";
import { createLockedSubmission } from "../db";

/**
 * Fires from a `navigator.sendBeacon` when a learner ends a case-study exam
 * or leaves the exam workspace. The in-progress attempt is locked immediately
 * with the answers saved so far, so the learner earns credit only for what
 * they actually answered - exactly like a real exam.
 */
export async function handleAutoSubmit(req: Request, res: Response) {
  let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    user = null;
  }
  if (!user) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  const rawAttemptId = req.query.attempt ?? req.body?.attemptId;
  const attemptId = Number(rawAttemptId);
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    res.status(400).json({ ok: false, error: "Invalid attempt" });
    return;
  }
  try {
    const result = await createLockedSubmission({ userId: user.id, attemptId, optOutOfMarking: true });
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(409).json({ ok: false, error: error instanceof Error ? error.message : "Could not submit attempt" });
  }
}