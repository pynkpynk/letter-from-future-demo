import test from "node:test";
import assert from "node:assert/strict";
import { computeProjections } from "@/lib/projections";
import { buildTemplateLetter } from "@/lib/letter/templateLetter";
import {
  hasForbiddenLetterTerms,
  hasProhibitedLetterPhrases,
  hasRequiredHookPhrase,
  hasRequiredLine5Hook,
  hasRequiredLine6Methods,
  hasSevenLines,
  hasSingleSentenceLine4,
  REQUIRED_HOOK_SENTENCE,
  REQUIRED_METHODS_SENTENCE,
  computeGapSeverity
} from "@/lib/letter/letterRules";
import {
  buildTemplateLetterVariant,
  pickTemplateVariant
} from "@/lib/letter/templateLetter";

test("template letter satisfies required rules", () => {
  const input = {
    age: 32,
    household_now: 2,
    kids_future: 1,
    annual_income_jpy: 4_500_000,
    monthly_savings_jpy: 20_000,
    current_savings_jpy: 2_000_000,
    monthly_invest_jpy: 30_000,
    current_invest_jpy: 500_000,
    goal: "mortgage",
    goal_other: ""
  };
  const projection = computeProjections(input)[0];
  const letter = buildTemplateLetter(input, projection);

  assert.equal(hasRequiredHookPhrase(letter), true);
  assert.equal(hasProhibitedLetterPhrases(letter), false);
  assert.equal(hasForbiddenLetterTerms(letter), false);
  assert.equal(hasSingleSentenceLine4(letter), true);
  assert.equal(hasSevenLines(letter), true);
  assert.equal(hasRequiredLine5Hook(letter), true);
  assert.equal(hasRequiredLine6Methods(letter), true);
  assert.ok(letter.includes(REQUIRED_HOOK_SENTENCE));
  assert.ok(letter.includes(REQUIRED_METHODS_SENTENCE));
});

test("template variant selection is deterministic", () => {
  const input = {
    age: 30,
    household_now: 2,
    kids_future: 1,
    annual_income_jpy: 4_000_000,
    monthly_savings_jpy: 20_000,
    current_savings_jpy: 2_000_000,
    monthly_invest_jpy: 10_000,
    current_invest_jpy: 500_000,
    goal: "fire" as const,
    goal_other: ""
  };
  const v1 = pickTemplateVariant(input);
  const v2 = pickTemplateVariant(input);
  assert.equal(v1, v2);
});

test("all goal variants pass letter rules", () => {
  const base = {
    age: 28,
    household_now: 1,
    kids_future: 0,
    annual_income_jpy: 3_500_000,
    monthly_savings_jpy: 10_000,
    current_savings_jpy: 1_000_000,
    monthly_invest_jpy: 0,
    current_invest_jpy: 0,
    goal_other: ""
  };
  const goals = ["entrepreneur", "fire", "mortgage", "overseas"] as const;
  for (const goal of goals) {
    for (const variant of [0, 1, 2] as const) {
      const input = { ...base, goal };
      const projection = computeProjections(input)[0];
      const letter = buildTemplateLetterVariant(input, variant, projection);
      assert.equal(hasRequiredHookPhrase(letter), true);
      assert.equal(hasProhibitedLetterPhrases(letter), false);
      assert.equal(hasForbiddenLetterTerms(letter), false);
      assert.equal(hasSingleSentenceLine4(letter), true);
      assert.equal(hasSevenLines(letter), true);
      assert.equal(hasRequiredLine5Hook(letter), true);
      assert.equal(hasRequiredLine6Methods(letter), true);
    }
  }
});

test("template letters mention the goal keyword", () => {
  const base = {
    age: 33,
    household_now: 2,
    kids_future: 1,
    annual_income_jpy: 4_000_000,
    monthly_savings_jpy: 20_000,
    current_savings_jpy: 500_000,
    monthly_invest_jpy: 10_000,
    current_invest_jpy: 200_000,
    goal_other: "世界旅行"
  };
  const goalExpect: Record<string, string> = {
    entrepreneur: "起業",
    fire: "FIRE",
    mortgage: "住宅ローン完済",
    overseas: "海外移住",
    other: "世界旅行"
  };
  const goals = ["entrepreneur", "fire", "mortgage", "overseas", "other"] as const;
  for (const goal of goals) {
    const input = { ...base, goal };
    const projection = computeProjections(input)[0];
    const letter = buildTemplateLetter(input, projection);
    const line3 = letter.split("\n")[2] ?? "";
    assert.ok(line3.includes(goalExpect[goal]));
  }
});

test("line2-4 do not end with よ。", () => {
  const input = {
    age: 29,
    household_now: 1,
    kids_future: 0,
    annual_income_jpy: 3_000_000,
    monthly_savings_jpy: 10_000,
    current_savings_jpy: 800_000,
    monthly_invest_jpy: 0,
    current_invest_jpy: 0,
    goal: "fire" as const,
    goal_other: ""
  };
  const projection = computeProjections(input)[0];
  const letter = buildTemplateLetter(input, projection);
  const lines = letter.split("\n");
  const line2 = lines[1] ?? "";
  const line3 = lines[2] ?? "";
  const line4 = lines[3] ?? "";
  assert.equal(line2.endsWith("よ。"), false);
  assert.equal(line3.endsWith("よ。"), false);
  assert.equal(line4.endsWith("よ。"), false);
});

test("line4 is single sentence and ends with 。", () => {
  const input = {
    age: 31,
    household_now: 2,
    kids_future: 1,
    annual_income_jpy: 3_200_000,
    monthly_savings_jpy: 5_000,
    current_savings_jpy: 100_000,
    monthly_invest_jpy: 0,
    current_invest_jpy: 0,
    goal: "mortgage" as const,
    goal_other: ""
  };
  const projection = computeProjections(input)[0];
  const letter = buildTemplateLetter(input, projection);
  const line4 = letter.split("\n")[3] ?? "";
  assert.equal((line4.match(/。/g) ?? []).length, 1);
  assert.equal(line4.endsWith("。"), true);
});

test("line2 and line3 endings are distinct", () => {
  const input = {
    age: 27,
    household_now: 1,
    kids_future: 0,
    annual_income_jpy: 3_100_000,
    monthly_savings_jpy: 12_000,
    current_savings_jpy: 300_000,
    monthly_invest_jpy: 0,
    current_invest_jpy: 0,
    goal: "entrepreneur" as const,
    goal_other: ""
  };
  const projection = computeProjections(input)[0];
  const letter = buildTemplateLetter(input, projection);
  const lines = letter.split("\n");
  const endings = ["ね。", "かな。", "って感じ。", "かも。", "なんだ。", "と思う。"];
  const pickEnding = (line: string) => endings.find((e) => line.endsWith(e)) ?? "";
  const e2 = pickEnding(lines[1] ?? "");
  const e3 = pickEnding(lines[2] ?? "");
  assert.notEqual(e2, "");
  assert.notEqual(e3, "");
  assert.notEqual(e2, e3);
  const stacked = /(ねかな|かなかも|ねって感じ|かなね|かもかな|ねかも|感じるなんだ|んだって感じ)/;
  assert.equal(stacked.test(lines[1] ?? ""), false);
  assert.equal(stacked.test(lines[2] ?? ""), false);
});

test("very far scenario uses strained but common vocabulary", () => {
  const input = {
    age: 34,
    household_now: 2,
    kids_future: 2,
    annual_income_jpy: 2_400_000,
    monthly_savings_jpy: 0,
    current_savings_jpy: 200_000,
    monthly_invest_jpy: 0,
    current_invest_jpy: 0,
    goal: "fire" as const,
    goal_other: ""
  };
  const projection = computeProjections(input)[0];
  const severity = computeGapSeverity({ input, projection });
  const letter = buildTemplateLetter(input, projection, severity);
  const strained = ["ギリギリ", "余裕がない", "苦しい", "しんどい", "厳しい"];
  assert.ok(severity >= 3);
  assert.ok(strained.some((word) => letter.includes(word)));
});
