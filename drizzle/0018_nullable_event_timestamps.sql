/**
 * Normalise "event" timestamps to explicit `NULL DEFAULT NULL`.
 *
 * A bare `timestamp` column can inherit `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
 * under older MySQL timestamp semantics (and remains ambiguous on newer engines). For coupons
 * that silently set `expiresAt` to "now" on insert and on every update, so every coupon read
 * back as already expired no matter how new it was. The same ambiguity can make unmarked
 * submissions look marked, unread notifications look read, and unfinished attempts look finished.
 */
ALTER TABLE `coupons` MODIFY `expiresAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `attempts` MODIFY `startedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `attempts` MODIFY `submittedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `entitlements` MODIFY `expiresAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `markings` MODIFY `markedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY `readAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY `emailedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `messages` MODIFY `readAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `supervisions` MODIFY `endedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `feedbackStates` MODIFY `releasedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `submissions` MODIFY `releasedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint

/**
 * Backfill the marking pipeline: every already-locked submission without a marking record gets an
 * open one, so the staff marking queue, instructor "To mark" and the performance dashboards pick
 * up the existing submissions immediately instead of waiting for new attempts.
 */
INSERT INTO `markings` (`attemptId`, `status`, `awardedPoints`, `totalPoints`, `createdAt`)
SELECT s.`attemptId`, 'unassigned', 0, 0, s.`submittedAt`
FROM `submissions` s
WHERE NOT EXISTS (SELECT 1 FROM `markings` m WHERE m.`attemptId` = s.`attemptId`);
