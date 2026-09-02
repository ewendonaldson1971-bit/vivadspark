export const STRATEGY_COACHING_AREAS = ["Safety", "Quality", "Delivery"] as const;

export type StrategyCoachingArea = (typeof STRATEGY_COACHING_AREAS)[number];

export type StrategyCoachingInput = {
  department: string;
  safety: number;
  quality: number;
  delivery: number;
  context: string;
};

export type StrategyCoaching = {
  summary: string;
  focusArea: StrategyCoachingArea;
  factResponses: Array<{ fact: string; interpretation: string; recommendedAction: string }>;
  suggestions: string[];
  reflectionQuestion: string;
};

export function validStrategyCoachingInput(value: unknown): value is StrategyCoachingInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<StrategyCoachingInput>;
  return typeof input.department === "string" && input.department.trim().length > 0 && input.department.length <= 80
    && [input.safety, input.quality, input.delivery].every((score) => typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100)
    && typeof input.context === "string" && input.context.length <= 2000;
}

export function sanitiseStrategyCoachingInput(input: StrategyCoachingInput) {
  return {
    department: input.department.trim().slice(0, 80),
    scores: {
      safety: Math.round(input.safety * 10) / 10,
      quality: Math.round(input.quality * 10) / 10,
      delivery: Math.round(input.delivery * 10) / 10,
    },
    operationalContext: input.context.trim().slice(0, 2000),
  };
}

export const strategyCoachingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "focusArea", "factResponses", "suggestions", "reflectionQuestion"],
  properties: {
    summary: { type: "string" },
    focusArea: { type: "string", enum: [...STRATEGY_COACHING_AREAS] },
    factResponses: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["fact", "interpretation", "recommendedAction"], properties: { fact: { type: "string" }, interpretation: { type: "string" }, recommendedAction: { type: "string" } } } },
    suggestions: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    reflectionQuestion: { type: "string" },
  },
} as const;

export function validateStrategyCoaching(value: unknown): value is StrategyCoaching {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<StrategyCoaching>;
  return typeof result.summary === "string" && result.summary.length > 0
    && STRATEGY_COACHING_AREAS.includes(result.focusArea as StrategyCoachingArea)
    && Array.isArray(result.factResponses) && result.factResponses.length <= 5
    && result.factResponses.every((item) => typeof item.fact === "string" && item.fact.length > 0 && typeof item.interpretation === "string" && item.interpretation.length > 0 && typeof item.recommendedAction === "string" && item.recommendedAction.length > 0)
    && Array.isArray(result.suggestions) && result.suggestions.length === 3
    && result.suggestions.every((suggestion) => typeof suggestion === "string" && suggestion.length > 0)
    && typeof result.reflectionQuestion === "string" && result.reflectionQuestion.length > 0;
}

function contextFacts(context: string) {
  return context.split(/\r?\n|[.;]+/).map((fact) => fact.replace(/\s+/g, " ").trim()).filter((fact) => fact.length > 2).slice(0, 5);
}

function coachFact(fact: string) {
  const text = fact.toLowerCase();
  if (/photo|proof of delivery|pod\b/.test(text)) return {
    fact,
    interpretation: "Delivery completion is not being supported by consistent evidence. This creates avoidable disputes and makes it impossible to verify the handover standard.",
    recommendedAction: "Make a delivery photo mandatory before a job can be closed: define the required view, name the person responsible, store it against the job, and audit the first five deliveries tomorrow.",
  };
  if (/damag|package|packaging|handling|defect|rework|quality/.test(text)) return {
    fact,
    interpretation: "This is an active quality containment issue, not simply a low score. Product may continue to be damaged until the exact handling or packaging failure point is observed.",
    recommendedAction: "Contain and inspect affected packages now, observe one package through the full handling route tomorrow, identify where damage first appears, then trial one controlled change and verify the next five packages before release.",
  };
  if (/late|delay|behind|missed|blocked|delivery/.test(text)) return {
    fact,
    interpretation: "Flow is being lost at a visible constraint or handover. Without an owner and check time, the delay will roll into the next shift.",
    recommendedAction: "List every at-risk job at the morning huddle, assign one next action and owner to each, remove the largest constraint first, and recheck progress at midday.",
  };
  if (/unsafe|hazard|near miss|incident|injur|risk/.test(text)) return {
    fact,
    interpretation: "The entry identifies a current safety exposure that needs containment and verification before normal work continues.",
    recommendedAction: "Stop and contain the exposure, confirm the critical control with the people doing the task, assign the corrective action, and verify the control at the work area tomorrow.",
  };
  if (/(safety|safe).*(good|no issue|fine|ok)|(?:good|no issue|fine|ok).*safety/.test(text)) return {
    fact,
    interpretation: "No safety issue was reported, which is positive, but a quiet day is not proof that critical controls were consistently followed.",
    recommendedAction: "Keep the current controls and complete one short verification tomorrow: observe the highest-risk task, confirm the control is present, and record any weak signal before it becomes an incident.",
  };
  if (/machine|equipment|breakdown|fault|maintenance/.test(text)) return {
    fact,
    interpretation: "Equipment condition is disrupting performance and may create repeat quality, safety or delivery losses if only the symptom is reset.",
    recommendedAction: "Record the fault condition and settings, contain affected output, give maintenance a named diagnostic check, and verify a controlled restart against the first acceptable result.",
  };
  if (/training|skill|knowledge|handover|standard work|sop/.test(text)) return {
    fact,
    interpretation: "There is a capability or standard-work gap. Repeating an instruction will not confirm that the task can be performed consistently.",
    recommendedAction: "Demonstrate the correct method at the job, have the person perform it back, record the result, and check the same task again on the next shift.",
  };
  if (/material|stock|supplier|substrate|ink|fabric/.test(text)) return {
    fact,
    interpretation: "The material condition or supply path may be contributing to the result and needs traceable evidence before process settings are changed.",
    recommendedAction: "Quarantine suspect material, record its batch and condition, compare it with a known-good batch, and release production only after the difference is verified.",
  };
  return {
    fact,
    interpretation: "The statement is relevant but not yet measurable enough to prove the cause or confirm improvement.",
    recommendedAction: "Turn this into an observable check tomorrow: define what happened, where, how often, the owner, and the time the result will be reviewed.",
  };
}

export function buildStrategyCoaching(input: StrategyCoachingInput): StrategyCoaching {
  const scores = [
    { area: "Safety" as const, score: input.safety },
    { area: "Quality" as const, score: input.quality },
    { area: "Delivery" as const, score: input.delivery },
  ].sort((a, b) => a.score - b.score);
  const focus = scores[0];
  const context = input.context.trim();
  const factResponses = contextFacts(context).map(coachFact);
  const suggestions: Record<StrategyCoachingArea, string[]> = {
    Safety: [
      "Start the shift with a five-minute review of the highest current risk and confirm the critical control at the work area.",
      "Give one named owner responsibility for the oldest open safety action and verify closure before the end-of-shift review.",
      "Ask the team for one new hazard or near-miss observation and record the agreed containment immediately.",
    ],
    Quality: [
      "Review yesterday’s most common defect at the morning huddle and agree one process condition to control today.",
      "Complete and record a first-off check before the first production run, with one named person responsible for verification.",
      "At midday, compare actual defects with the morning baseline and adjust the standard or containment if the result is not improving.",
    ],
    Delivery: [
      "Identify the job most at risk of missing its promise time and remove or escalate its largest constraint at the morning huddle.",
      "Assign one owner and next action to every blocked job, including a check time rather than waiting until end of shift.",
      "Review plan versus actual before the final hour and agree the first recovery action for tomorrow’s shift.",
    ],
  };
  const contextActions = factResponses.map((response) => response.recommendedAction);
  const priorityActions = [...contextActions, ...suggestions[focus.area]].filter((action, index, all) => all.indexOf(action) === index).slice(0, 3);
  return {
    summary: `${input.department} should focus first on ${focus.area.toLowerCase()}, currently the lowest supplied score at ${focus.score}%.${factResponses.length ? ` The team reported ${factResponses.length} concrete ${factResponses.length === 1 ? "fact" : "facts"}; the coaching below addresses each one directly rather than relying on the score alone.` : " No operational facts were supplied, so the score identifies priority but does not prove the cause."}`,
    focusArea: focus.area,
    factResponses,
    suggestions: priorityActions,
    reflectionQuestion: `What observable result by tomorrow would prove that the ${focus.area.toLowerCase()} action made the biggest difference?`,
  };
}
