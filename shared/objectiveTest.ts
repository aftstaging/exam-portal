export type ObjectiveQuestionRecord = {
  prompt: string;
  optionsJson: string;
  answerJson: string;
  questionType?: "single_choice" | "multiple_choice" | "dropdown" | "numerical" | "text_input" | string | null;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentMimeType?: string | null;
  explanation?: string | null;
  topic?: string | null;
};

export type ObjectiveAnswer = number | number[] | string;

export type ParsedObjectiveQuestion = {
  prompt: string;
  options: string[];
  correct: ObjectiveAnswer;
  questionType: "single_choice" | "multiple_choice" | "dropdown" | "numerical" | "text_input";
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  topic: string;
  explanation: string;
};

export function parseObjectiveQuestion(item: ObjectiveQuestionRecord): ParsedObjectiveQuestion {
  let options: string[] = [];
  let correct: ObjectiveAnswer = 0;
  try { options = JSON.parse(item.optionsJson) as string[]; } catch { options = []; }
  try {
    const parsed = JSON.parse(item.answerJson);
    correct = Array.isArray(parsed) ? parsed : parsed;
  } catch { correct = 0; }
  const rawType = item.questionType ?? "single_choice";
  const questionType = ["single_choice", "multiple_choice", "dropdown", "numerical", "text_input"].includes(rawType)
    ? rawType as ParsedObjectiveQuestion["questionType"]
    : "single_choice";
  return {
    prompt: item.prompt,
    options,
    correct,
    questionType,
    attachmentUrl: item.attachmentUrl,
    attachmentFileName: item.attachmentFileName,
    topic: item.topic ?? "General",
    explanation: item.explanation ?? "Review the underlying learning outcome and retry this question.",
  };
}

export function selectObjectiveQuestions<T extends { topic: string }>(questions: T[], topic: string, count: number | "all") {
  const filtered = topic === "All topics" ? questions : questions.filter((item) => item.topic === topic);
  return filtered.slice(0, count === "all" ? filtered.length : Math.min(count, filtered.length));
}

export function objectiveAnswerMatches(actual: ObjectiveAnswer | undefined, expected: ObjectiveAnswer) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return [...actual].sort().join(",") === [...expected].sort().join(",");
  }
  if (typeof expected === "string") return String(actual ?? "").trim().toLowerCase() === expected.trim().toLowerCase();
  return actual === expected;
}

export function scoreObjectiveAnswers(questions: Array<{ correct: ObjectiveAnswer }>, answers: Record<number, ObjectiveAnswer>) {
  return questions.reduce((total, item, index) => total + (objectiveAnswerMatches(answers[index], item.correct) ? 1 : 0), 0);
}
