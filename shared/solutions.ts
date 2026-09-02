export type SolutionAttemptStatus = "not_started" | "in_progress" | "submitted" | "awaiting_marking" | "marked" | "expired" | "cancelled";

export type SolutionSection = {
  sectionNumber: number;
  title: string;
  introduction: string | null;
};

export type IllustrativeSolution = {
  sectionNumber: number;
  heading: string;
  body: string;
};

const AFT_NOTICE = "This is an imaginary practice explanation created by AFT, not an official answer, publisher solution, or awarded mark.";

const solutionRecords: Record<string, Array<{ heading: string; body: string }>> = {
  "Cartn Mock Exam 3": [
    { heading: "Risks and negotiation plan", body: "An illustrative response would separate the commercial, operational, and reputational risks in the scenario, then propose a negotiation plan that protects value while keeping the key relationship workable. It would state assumptions, rank the risks, and define the evidence needed before agreeing terms." },
    { heading: "Disruptive technology response", body: "An illustrative response would assess how the technology could change customer expectations, processes, cost-to-serve, and control requirements. It would recommend a staged pilot with success measures, ownership, training, and a review point before wider adoption." },
    { heading: "Funding and ratio analysis", body: "An illustrative response would compare the funding alternatives against liquidity, leverage, flexibility, and stakeholder expectations. It would use the available ratios as signals rather than isolated answers, explain the trade-offs, and recommend a funding mix with monitoring thresholds." },
    { heading: "Pricing and communication", body: "An illustrative response would link the pricing decision to customer value, cost drivers, competitor context, and the organisation’s objectives. It would then propose a communication sequence for affected stakeholders, including the message, channel, timing, likely objections, and feedback loop." },
  ],
  "Cartn Mock Exam 4": [
    { heading: "Digital data sources and value management", body: "An illustrative response would identify which digital data sources could improve the decision, test their reliability and ownership, and connect the analysis to value-management techniques. It would explain how management can avoid chasing activity metrics that do not translate into measurable value." },
    { heading: "Business model and stakeholder alignment", body: "An illustrative response would describe the business model, the assumptions that make it viable, and the stakeholder interests that could support or block delivery. It would recommend a practical alignment plan with decision rights, communication, and measures of progress." },
    { heading: "Risk evaluation and project controls", body: "An illustrative response would evaluate risk using likelihood, impact, proximity, and controllability, then connect the priorities to project-management tools. It would set out stage gates, owners, escalation triggers, and a reporting cadence that supports timely intervention." },
    { heading: "Accounting treatment and stakeholder management", body: "An illustrative response would explain the relevant accounting judgement, the information required to support it, and the risks of inconsistent treatment. It would pair that analysis with a stakeholder-management plan that anticipates challenge, documents decisions, and keeps the outcome understandable." },
  ],
  "CIMA MCS Mock B, May & August 2026": [
    { heading: "Task 1 illustrative response", body: "An illustrative response would define the decision to be made, distinguish facts from assumptions, and evaluate the commercial consequences using a balanced management-accounting lens. It would close with a recommendation, key risk, and next evidence request." },
    { heading: "Task 2 illustrative response", body: "An illustrative response would compare the available options, explain how each affects customers, operations, people, and cash, and identify the control that should be monitored first. It would make the trade-off explicit rather than presenting an unsupported single answer." },
    { heading: "Task 3 illustrative response", body: "An illustrative response would connect the scenario analysis to implementation: ownership, sequencing, measures, and escalation. It would note the downside case, propose a mitigation, and explain how management would know whether the intervention is working." },
    { heading: "Task 4 illustrative response", body: "An illustrative response would synthesise the evidence into a concise professional recommendation. It would acknowledge uncertainty, show how stakeholder perspectives affect the decision, and set out a short review cycle with clear success criteria." },
  ],
};

export function canViewIllustrativeSolutions(status: SolutionAttemptStatus | undefined) {
  return status === "submitted" || status === "awaiting_marking" || status === "marked";
}

export function solutionAccessLabel(status: SolutionAttemptStatus | undefined) {
  if (canViewIllustrativeSolutions(status)) return "Illustrative guide unlocked";
  if (status === "in_progress") return "Solutions unlock after submission";
  return "Complete an interactive attempt to unlock solutions";
}

export function getIllustrativeSolutions(examTitle: string | undefined, sections: SolutionSection[]): IllustrativeSolution[] {
  const records = solutionRecords[examTitle ?? ""];
  return sections.map((section, index) => {
    const record = records?.[index];
    const sectionLabel = section.title || `Section ${section.sectionNumber}`;
    const body = record ? `${record.body} ${AFT_NOTICE}` : `Using the imported brief “${section.introduction?.trim() || sectionLabel}”, an AFT-created practice response would identify the decision, test the assumptions, compare options, and recommend a measurable next step. ${AFT_NOTICE}`;
    return { sectionNumber: section.sectionNumber, heading: record?.heading ?? `Illustrative approach for ${sectionLabel}`, body };
  });
}
