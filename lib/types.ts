export type LetterInput = {
  age: number;
  household_now: number;
  kids_future: number;
  annual_income_jpy: number;
  monthly_savings_jpy: number;
  current_savings_jpy: number;
  monthly_invest_jpy: number;
  current_invest_jpy: number;
  goal: "entrepreneur" | "fire" | "mortgage" | "overseas" | "other";
  goal_other?: string;
};

export type LetterProjection = {
  years: number;
  savings_future: number;
  invest_min: number;
  invest_max: number;
  total_min: number;
  total_max: number;
  monthly_spending_est_now: number;
  monthly_spending_est_future: number;
  monthly_spending_est_10y: number;
  monthly_surplus_est_low: number;
  monthly_surplus_est_high: number;
  used_monthly_savings: number;
  used_monthly_invest: number;
  used_monthly_total: number;
  used_monthly_total_low: number;
  used_monthly_total_high: number;
  runway_months_min: number;
  runway_months_max: number;
  goal_gap_label: "達成できてる" | "もう少し" | "まだ遠い";
};

export type LetterContent = {
  letter: string;
  plan_save: string;
  plan_grow: string;
  plan_protect: string;
  cta: string;
  summary: string;
  disclaimer: string;
  evidence_summary?: string[];
  evidence_details?: string;
  evidence?: string;
  three_methods?: { title: string; detail: string }[];
};

export type LetterApiSuccess = {
  ok: true;
  projections: LetterProjection[];
  content: LetterContent;
};

export type LetterApiError = {
  ok: false;
  projections?: LetterProjection[];
  error: {
    message: string;
    code?: string;
    status?: number | null;
    name?: string;
    request_id?: string | null;
    upstream_message?: string | null;
    upstream_code?: string | null;
    upstream_type?: string | null;
    upstream_param?: string | null;
    model?: string | null;
    detail?: string | null;
    hint?: string;
  };
};

export type LetterApiResponse = LetterApiSuccess | LetterApiError;
