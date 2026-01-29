import test from "node:test";
import assert from "node:assert/strict";
import { computeProjections, estimateSpendingMonthly } from "@/lib/projections";
import type { LetterInput } from "@/lib/types";

const baseInput: LetterInput = {
  age: 32,
  household_now: 2,
  kids_future: 1,
  annual_income_jpy: 4_500_000,
  monthly_savings_jpy: 20_000,
  current_savings_jpy: 2_000_000,
  monthly_invest_jpy: 30_000,
  current_invest_jpy: 500_000,
  goal: "mortgage"
};

test("computeProjections returns 10 year range only", () => {
  const projections = computeProjections(baseInput);
  assert.equal(projections.length, 1);
  assert.equal(projections[0].years, 10);
});

test("savings future uses simple accumulation", () => {
  const projections = computeProjections({
    ...baseInput,
    annual_income_jpy: 9_000_000
  });
  const tenYear = projections[0];
  const expected = 2_000_000 + 20_000 * 12 * 10;
  assert.equal(tenYear.savings_future, expected);
});

test("invest range stays within min/max ordering", () => {
  const projections = computeProjections(baseInput);
  for (const projection of projections) {
    assert.ok(projection.invest_min <= projection.invest_max);
    assert.ok(projection.total_min <= projection.total_max);
  }
});

test("investment contributions are included in invest range", () => {
  const projections = computeProjections({
    ...baseInput,
    current_invest_jpy: 500_000,
    monthly_invest_jpy: 30_000
  });
  const projection = projections[0];
  assert.ok(projection.invest_min > 2_000_000);
  assert.ok(projection.invest_max > projection.invest_min);
});

test("estimateSpendingMonthly uses single household baseline", () => {
  const value = estimateSpendingMonthly(1);
  assert.equal(value, 169_547);
});

test("lifeQualityTier reflects deficit vs comfort", () => {
  const deficit = computeProjections({
    ...baseInput,
    annual_income_jpy: 2_000_000,
    household_now: 2,
    monthly_savings_jpy: 50_000,
    monthly_invest_jpy: 50_000
  })[0] as any;
  const comfortable = computeProjections({
    ...baseInput,
    annual_income_jpy: 10_000_000,
    household_now: 1,
    monthly_savings_jpy: 0,
    monthly_invest_jpy: 0
  })[0] as any;
  assert.equal(deficit.life_quality_tier, 1);
  assert.equal(comfortable.life_quality_tier, 5);
});

test("contribution capping clamps to zero when surplus is negative", () => {
  const projections = computeProjections({
    ...baseInput,
    annual_income_jpy: 1_000_000,
    monthly_savings_jpy: 50_000,
    monthly_invest_jpy: 50_000
  });
  const projection = projections[0];
  assert.equal(projection.used_monthly_total, 0);
  assert.equal(projection.used_monthly_savings, 0);
  assert.equal(projection.used_monthly_invest, 0);
  assert.equal(projection.goal_gap_label, "まだ遠い");
});

test("runway months are non-negative and goal gap label follows heuristic", () => {
  const projections = computeProjections({
    ...baseInput,
    annual_income_jpy: 12_000_000
  });
  const projection = projections[0];
  assert.ok(projection.runway_months_min >= 0);
  assert.ok(projection.runway_months_max >= 0);
  assert.ok(
    ["達成できてる", "もう少し", "まだ遠い"].includes(projection.goal_gap_label)
  );
});
