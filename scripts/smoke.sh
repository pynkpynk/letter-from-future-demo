#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"

if [[ "${SMOKE_ASSUME_RUNNING:-}" != "1" ]]; then
  echo "Starting dev server..."
  npm --prefix "$ROOT_DIR" run dev -- --port "$PORT" > /tmp/letter-from-future-dev.log 2>&1 &
  DEV_PID=$!
  trap 'kill $DEV_PID 2>/dev/null || true' EXIT

  for _ in {1..30}; do
    if curl -s "$BASE_URL/letter-from-future" > /dev/null; then
      break
    fi
    sleep 1
  done
fi

payload='{"age":32,"household_now":2,"kids_future":2,"annual_income_jpy":4500000,"monthly_savings_jpy":20000,"current_savings_jpy":2000000,"monthly_invest_jpy":30000,"current_invest_jpy":500000,"goal":"mortgage"}'

response=$(curl -s -X POST "$BASE_URL/letter-from-future/api/letter" \
  -H "Content-Type: application/json" \
  -d "$payload")

node --input-type=module -e "
const data = JSON.parse(process.argv[1]);
if (!data.ok) {
  console.error('API returned error:', data.error?.code, data.error?.message);
  if (data.error?.status) console.error('status:', data.error.status);
  if (data.error?.request_id) console.error('request_id:', data.error.request_id);
  if (data.error?.model) console.error('model:', data.error.model);
  if (data.error?.upstream_message) console.error('upstream_message:', data.error.upstream_message);
  if (data.error?.upstream_code) console.error('upstream_code:', data.error.upstream_code);
  if (data.error?.detail) console.error('detail:', data.error.detail);
  if (data.error?.code === 'missing_api_key') {
    console.error('Hint: Set OPENAI_API_KEY in .env.local');
  }
  if (data.error?.hint) console.error('hint:', data.error.hint);
  throw new Error('API returned error');
}
const keys = ['letter','plan_save','plan_grow','plan_protect','cta','summary','disclaimer'];
for (const key of keys) {
  if (!data.content || typeof data.content[key] !== 'string') {
    throw new Error('Missing content key: ' + key);
  }
}
const errors = {};
if (!Array.isArray(data.projections) || data.projections.length < 1) {
  errors.projections = 'missing_or_empty';
} else {
  const first = data.projections[0];
  if (first?.years !== 10) errors.years = first?.years ?? null;
  const numericFields = [
    'monthly_spending_est_10y',
    'monthly_surplus_est_low',
    'monthly_surplus_est_high',
    'used_monthly_total',
    'used_monthly_total_low',
    'used_monthly_total_high'
  ];
  for (const field of numericFields) {
    if (typeof first?.[field] !== 'number') {
      errors[field] = typeof first?.[field];
    }
  }
}
if (Object.keys(errors).length) {
  console.error('Projection validation failed:', JSON.stringify(errors));
  throw new Error('Invalid projections');
}
" "$response"

echo "Smoke test passed."
