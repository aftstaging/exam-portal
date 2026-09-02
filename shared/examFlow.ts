export function canStartExamBeforeCooldown(countdownSeconds: number) {
  return countdownSeconds >= 0;
}

export function shouldAutoStartExam(countdownSeconds: number) {
  return countdownSeconds <= 0;
}
