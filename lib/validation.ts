import type { LetterInput } from "@/lib/types";

type ValidationResult =
  | { ok: true; data: LetterInput }
  | { ok: false; message: string; code: string; status: number };

type Range = { min: number; max: number };

type FieldSpec = {
  key: keyof LetterInput;
  label: string;
  range: Range;
};

const FIELD_SPECS: FieldSpec[] = [
  { key: "age", label: "age", range: { min: 18, max: 80 } },
  { key: "household_now", label: "household_now", range: { min: 1, max: 6 } },
  { key: "kids_future", label: "kids_future", range: { min: 0, max: 4 } },
  {
    key: "annual_income_jpy",
    label: "annual_income_jpy",
    range: { min: 0, max: 50_000_000 }
  },
  {
    key: "monthly_savings_jpy",
    label: "monthly_savings_jpy",
    range: { min: 0, max: 2_000_000 }
  },
  {
    key: "current_savings_jpy",
    label: "current_savings_jpy",
    range: { min: 0, max: 200_000_000 }
  },
  {
    key: "monthly_invest_jpy",
    label: "monthly_invest_jpy",
    range: { min: 0, max: 2_000_000 }
  },
  {
    key: "current_invest_jpy",
    label: "current_invest_jpy",
    range: { min: 0, max: 200_000_000 }
  }
];

const GOALS = ["entrepreneur", "fire", "mortgage", "overseas", "other"] as const;

function parseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function parseLetterInput(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      message: "JSON body is required.",
      code: "invalid_body",
      status: 400
    };
  }

  const record = payload as Record<string, unknown>;
  const parsed: Partial<LetterInput> = {};

  for (const spec of FIELD_SPECS) {
    const value = parseInteger(record[spec.key]);
    if (value === null) {
      return {
        ok: false,
        message: `${spec.label} must be an integer.`,
        code: "invalid_type",
        status: 400
      };
    }
    if (value < spec.range.min || value > spec.range.max) {
      return {
        ok: false,
        message: `${spec.label} must be between ${spec.range.min} and ${spec.range.max}.`,
        code: "out_of_range",
        status: 400
      };
    }
    (parsed as Record<string, number>)[spec.key] = value;
  }

  const goal = record.goal;
  if (typeof goal !== "string" || !GOALS.includes(goal as any)) {
    return {
      ok: false,
      message: "goal must be a valid option.",
      code: "invalid_goal",
      status: 400
    };
  }

  let goalOther: string | undefined = undefined;
  if (goal === "other") {
    const raw = record.goal_other;
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return {
        ok: false,
        message: "goal_other is required when goal is other.",
        code: "invalid_goal_other",
        status: 400
      };
    }
    const trimmed = raw.trim();
    if (trimmed.length > 40) {
      return {
        ok: false,
        message: "goal_other must be 40 chars or less.",
        code: "invalid_goal_other",
        status: 400
      };
    }
    goalOther = trimmed;
  }

  return {
    ok: true,
    data: {
      ...(parsed as LetterInput),
      goal: goal as LetterInput["goal"],
      ...(goalOther ? { goal_other: goalOther } : {})
    }
  };
}
