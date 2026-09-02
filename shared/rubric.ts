export const RUBRIC_CRITERIA = [
  "Analysis and evaluation",
  "Application to the case",
  "Professional judgement",
  "Clarity and structure",
] as const;

export function calculateRubricScore(scores: number[]): { awardedPoints: number; totalPoints: number } {
  const safeScores = scores.map((score) => Math.min(5, Math.max(0, Math.round(score))));
  return { awardedPoints: safeScores.reduce((sum, score) => sum + score, 0), totalPoints: RUBRIC_CRITERIA.length * 5 };
}
