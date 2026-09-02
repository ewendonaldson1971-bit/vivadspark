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
  required: ["summary", "focusArea", "suggestions", "reflectionQuestion"],
  properties: {
    summary: { type: "string" },
    focusArea: { type: "string", enum: [...STRATEGY_COACHING_AREAS] },
    suggestions: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    reflectionQuestion: { type: "string" },
  },
} as const;

export function validateStrategyCoaching(value: unknown): value is StrategyCoaching {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<StrategyCoaching>;
  return typeof result.summary === "string" && result.summary.length > 0
    && STRATEGY_COACHING_AREAS.includes(result.focusArea as StrategyCoachingArea)
    && Array.isArray(result.suggestions) && result.suggestions.length === 3
    && result.suggestions.every((suggestion) => typeof suggestion === "string" && suggestion.length > 0)
    && typeof result.reflectionQuestion === "string" && result.reflectionQuestion.length > 0;
}

export function buildStrategyCoaching(input: StrategyCoachingInput): StrategyCoaching {
  const scores = [
    { area: "Safety" as const, score: input.safety },
    { area: "Quality" as const, score: input.quality },
    { area: "Delivery" as const, score: input.delivery },
  ].sort((a, b) => a.score - b.score);
  const focus = scores[0];
  const context = input.context.trim();
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
  return {
    summary: `${input.department} should focus first on ${focus.area.toLowerCase()}, currently the lowest supplied score at ${focus.score}%.${context ? " The suggested actions also consider the operational context entered by the team." : " Add factual shift context next time to make the coaching more specific."}`,
    focusArea: focus.area,
    suggestions: suggestions[focus.area],
    reflectionQuestion: `What observable result by tomorrow would prove that the ${focus.area.toLowerCase()} action made the biggest difference?`,
  };
}
