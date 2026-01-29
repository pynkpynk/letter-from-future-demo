# A Letter From the Future (demo)

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your OpenAI API key to `.env.local`:

```
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
```

## Run dev server

```bash
npm run dev
```

Open `http://localhost:3000/letter-from-future`.

## API test with curl

```bash
curl -X POST http://localhost:3000/letter-from-future/api/letter \
  -H "Content-Type: application/json" \
  -d '{
    "age": 32,
    "household_now": 2,
    "kids_future": 2,
    "annual_income_jpy": 4500000,
    "monthly_savings_jpy": 50000,
    "current_savings_jpy": 2000000,
    "monthly_invest_jpy": 30000,
    "current_invest_jpy": 500000,
    "goal": "mortgage"
  }'
```

## Tests

```bash
npm run test
```
# letter-from-future
