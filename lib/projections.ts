import type { LetterInput, LetterProjection } from "@/lib/types";

const RATES = [0.02, 0.06];
const YEARS = 10;
// Source: Statistics Bureau FIES 2024 avg
const SINGLE_SPENDING = 169_547;
// Source: Statistics Bureau FIES 2024 avg
const MULTI_SPENDING = 300_243;
const MULTI_SIZE = 2.88;

function computeInvestFuture(
  currentInvest: number,
  monthlyInvest: number,
  years: number,
  rate: number
): number {
  const growth = Math.pow(1 + rate, years);
  const annuity = (growth - 1) / rate;
  const future = currentInvest * growth + monthlyInvest * 12 * annuity;
  return Math.round(future);
}

export function estimateSpendingMonthly(householdSize: number): number {
  if (householdSize <= 1) {
    return SINGLE_SPENDING;
  }
  const scaled = MULTI_SPENDING * Math.pow(householdSize / MULTI_SIZE, 0.85);
  return Math.round(scaled);
}

export function computeProjections(input: LetterInput): LetterProjection[] {
  const householdNow = input.household_now;
  const householdFuture = householdNow + input.kids_future;
  const spendingNow = estimateSpendingMonthly(householdNow);
  const spendingFuture = estimateSpendingMonthly(householdFuture);
  const spending10y = Math.round((spendingNow + spendingFuture) / 2);

  const takehomeLow = (input.annual_income_jpy / 12) * 0.75;
  const takehomeHigh = (input.annual_income_jpy / 12) * 0.85;
  const surplusLow = Math.max(0, Math.round(takehomeLow - spending10y));
  const surplusHigh = Math.max(0, Math.round(takehomeHigh - spending10y));

  const userMonthlyTotal =
    input.monthly_savings_jpy + input.monthly_invest_jpy;
  const usedMonthlyTotalLow = Math.min(userMonthlyTotal, surplusLow);
  const usedMonthlyTotalHigh = Math.min(userMonthlyTotal, surplusHigh);
  const saveRatio =
    userMonthlyTotal > 0 ? input.monthly_savings_jpy / userMonthlyTotal : 0;
  const investRatio =
    userMonthlyTotal > 0 ? input.monthly_invest_jpy / userMonthlyTotal : 0;
  const usedMonthlySavings = Math.round(usedMonthlyTotalLow * saveRatio);
  const usedMonthlyInvest = Math.round(usedMonthlyTotalLow * investRatio);

  const savingsFuture = Math.round(
    input.current_savings_jpy + input.monthly_savings_jpy * 12 * YEARS
  );
  const investValues = RATES.map((rate) =>
    computeInvestFuture(input.current_invest_jpy, usedMonthlyInvest, YEARS, rate)
  );
  const investMin = Math.min(...investValues);
  const investMax = Math.max(...investValues);
  const runwayMin =
    spending10y > 0 ? Math.round((savingsFuture + investMin) / spending10y) : 0;
  const runwayMax =
    spending10y > 0 ? Math.round((savingsFuture + investMax) / spending10y) : 0;
  const goalGapLabel =
    usedMonthlyTotalHigh === 0 || runwayMax < 6
      ? "まだ遠い"
      : runwayMax < 12
      ? "もう少し"
      : "達成できてる";

  return [
    {
      years: YEARS,
      savings_future: savingsFuture,
      invest_min: investMin,
      invest_max: investMax,
      total_min: savingsFuture + investMin,
      total_max: savingsFuture + investMax,
      monthly_spending_est_now: spendingNow,
      monthly_spending_est_future: spendingFuture,
      monthly_spending_est_10y: spending10y,
      monthly_surplus_est_low: surplusLow,
      monthly_surplus_est_high: surplusHigh,
      used_monthly_savings: usedMonthlySavings,
      used_monthly_invest: usedMonthlyInvest,
      used_monthly_total: Math.round(usedMonthlySavings + usedMonthlyInvest),
      used_monthly_total_low: Math.round(usedMonthlyTotalLow),
      used_monthly_total_high: Math.round(usedMonthlyTotalHigh),
      runway_months_min: runwayMin,
      runway_months_max: runwayMax,
      goal_gap_label: goalGapLabel
    }
  ];
}
