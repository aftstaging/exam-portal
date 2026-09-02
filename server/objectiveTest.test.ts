import { describe, expect, it } from "vitest";
import { objectiveAnswerMatches, parseObjectiveQuestion, scoreObjectiveAnswers, selectObjectiveQuestions } from "../shared/objectiveTest";

describe("objective-test helpers", () => {
  const questions = [
    { prompt: "One", optionsJson: '["A","B"]', answerJson: "1", topic: "Budgeting", explanation: "Because B." },
    { prompt: "Two", optionsJson: '["C","D"]', answerJson: "0", topic: "Reporting", explanation: "Because C." },
  ];

  it("parses stored answer and option JSON safely", () => {
    expect(parseObjectiveQuestion(questions[0])).toMatchObject({ prompt: "One", options: ["A", "B"], correct: 1, topic: "Budgeting" });
  });

  it("filters by topic and caps the configured set size", () => {
    const parsed = questions.map(parseObjectiveQuestion);
    expect(selectObjectiveQuestions(parsed, "Budgeting", "all")).toHaveLength(1);
    expect(selectObjectiveQuestions(parsed, "All topics", 1)).toHaveLength(1);
  });

  it("scores selected answers against parsed correct indices", () => {
    const parsed = questions.map(parseObjectiveQuestion);
    expect(scoreObjectiveAnswers(parsed, { 0: 1, 1: 0 })).toBe(2);
  });

  it("supports richer question types, attachment metadata, and answer matching", () => {
    const multiple = parseObjectiveQuestion({ prompt: "Select two", optionsJson: '["A","B","C"]', answerJson: "[0,2]", questionType: "multiple_choice", attachmentUrl: "https://cdn.example.test/chart.png", attachmentFileName: "chart.png", topic: "Analysis" });
    const text = parseObjectiveQuestion({ prompt: "Enter value", optionsJson: "[]", answerJson: '"42"', questionType: "numerical", topic: "Analysis" });
    expect(multiple).toMatchObject({ questionType: "multiple_choice", correct: [0, 2], attachmentFileName: "chart.png" });
    expect(objectiveAnswerMatches([2, 0], multiple.correct)).toBe(true);
    expect(objectiveAnswerMatches("42", text.correct)).toBe(true);
  });
});
