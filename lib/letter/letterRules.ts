import type { LetterInput, LetterProjection } from "@/lib/types";

export const FORBIDDEN_LETTER_TERMS = [
  "レンジ",
  "比率",
  "%",
  "上限",
  "税引",
  "円",
  "万円",
  "月",
  "年収",
  "手取り",
  "家計調査",
  "消費支出",
  "二人以上",
  "Habitto"
] as const;

export function hasForbiddenLetterTerms(text: string): boolean {
  return FORBIDDEN_LETTER_TERMS.some((term) => text.includes(term));
}

export const PROHIBITED_LETTER_PHRASES = [
  "口座開設",
  "口座を作って",
  "口座作成",
  "今日の準備",
  "今日の準備にかかってる",
  "今日の準備にかかっている",
  "今日の準備にかかってた",
  "今日の準備にかかっていた"
] as const;

export function hasProhibitedLetterPhrases(text: string): boolean {
  return PROHIBITED_LETTER_PHRASES.some((term) => text.includes(term));
}

export const REQUIRED_HOOK_SENTENCE =
  "十年後の安心は、あの日の準備にかかってたと思う。";
export const REQUIRED_METHODS_SENTENCE =
  "理想の未来を創る３つの方法は、「貯める工夫」・「賢く使う」・「プロに相談する」だよ。";

export function hasRequiredHookPhrase(text: string): boolean {
  return text.includes(REQUIRED_HOOK_SENTENCE);
}

export function hasRequiredMethodsLine(text: string): boolean {
  return text.includes(REQUIRED_METHODS_SENTENCE);
}

export function hasSevenLines(text: string): boolean {
  const lines = text.split(/\n/).filter(Boolean);
  return lines.length === 7;
}

export function hasSingleSentenceLine4(text: string): boolean {
  const lines = text.split(/\n/);
  if (lines.length < 4) return false;
  const line = lines[3].trim();
  if (!line) return false;
  const count = (line.match(/。/g) ?? []).length;
  return count === 1 && line.endsWith("。");
}

export function hasRequiredLine5Hook(text: string): boolean {
  const lines = text.split(/\n/);
  return lines[4]?.trim() === REQUIRED_HOOK_SENTENCE;
}

export function hasRequiredLine6Methods(text: string): boolean {
  const lines = text.split(/\n/);
  return lines[5]?.trim() === REQUIRED_METHODS_SENTENCE;
}

export function computeGapSeverity({
  input,
  projection
}: {
  input: LetterInput;
  projection?: LetterProjection | null;
}): 0 | 1 | 2 | 3 | 4 {
  const tier = (projection as { life_quality_tier?: number } | null)?.life_quality_tier;
  if (typeof tier === "number") {
    if (tier <= 1) return 4;
    if (tier === 2) return 3;
    if (tier === 3) return 2;
    if (tier === 4) return 1;
    return 0;
  }
  if (!projection) return 1;
  const monthlyInputTotal =
    (input.monthly_savings_jpy ?? 0) + (input.monthly_invest_jpy ?? 0);
  const surplusHigh = projection.monthly_surplus_est_high;
  const surplusLow = projection.monthly_surplus_est_low;
  const runwayMax = projection.runway_months_max;
  const usedHigh = projection.used_monthly_total_high;
  if (surplusHigh <= 0 || runwayMax < 3) return 4;
  if (
    runwayMax < 6 ||
    (projection.goal_gap_label === "まだ遠い" &&
      usedHigh < monthlyInputTotal * 0.5)
  ) {
    return 3;
  }
  if (projection.goal_gap_label === "まだ遠い" || surplusLow <= 0) return 2;
  if (projection.goal_gap_label === "もう少し") return 1;
  return 0;
}

const METHODS_RAW = [
  { title: "貯める", detail: "高金利の預金" },
  { title: "使う", detail: "デビット還元" },
  { title: "相談する", detail: "無料FP相談" }
] as const;

function wrapMethodTitle(title: string): string {
  const stripped = title.replace(/^「|」$/g, "");
  return `「${stripped}」`;
}

export function buildThreeMethods() {
  return METHODS_RAW.map((method) => ({
    title: wrapMethodTitle(method.title),
    detail: method.detail
  }));
}
