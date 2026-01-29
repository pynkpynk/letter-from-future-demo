import test from "node:test";
import assert from "node:assert/strict";
import { parseLetterInput } from "@/lib/validation";

const validPayload = {
  age: 32,
  household_now: 2,
  kids_future: 2,
  annual_income_jpy: 4_500_000,
  monthly_savings_jpy: 20_000,
  current_savings_jpy: 2_000_000,
  monthly_invest_jpy: 30_000,
  current_invest_jpy: 500_000,
  goal: "mortgage"
};

test("parseLetterInput accepts valid input", () => {
  const result = parseLetterInput(validPayload);
  assert.equal(result.ok, true);
});

test("parseLetterInput rejects missing fields", () => {
  const result = parseLetterInput({ age: 20 });
  assert.equal(result.ok, false);
});

test("parseLetterInput rejects out of range values", () => {
  const result = parseLetterInput({ ...validPayload, age: 10 });
  assert.equal(result.ok, false);
});

test("parseLetterInput requires goal_other when goal is other", () => {
  const result = parseLetterInput({ ...validPayload, goal: "other" });
  assert.equal(result.ok, false);
});

test("parseLetterInput accepts goal_other within limit", () => {
  const result = parseLetterInput({
    ...validPayload,
    goal: "other",
    goal_other: "地方移住"
  });
  assert.equal(result.ok, true);
});
