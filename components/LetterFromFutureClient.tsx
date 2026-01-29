"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Klee_One } from "next/font/google";
import type {
  LetterApiResponse,
  LetterContent,
  LetterInput,
  LetterProjection
} from "@/lib/types";

const SAMPLE_INPUT: LetterInput = {
  age: 32,
  household_now: 2,
  kids_future: 2,
  annual_income_jpy: 4_500_000,
  monthly_savings_jpy: 20_000,
  current_savings_jpy: 2_000_000,
  monthly_invest_jpy: 30_000,
  current_invest_jpy: 500_000,
  goal: "entrepreneur",
  goal_other: ""
};

const DISCLAIMER_REQUIRED =
  "※支出例の他、ケガ・病気・住宅などの大きな支出、公的負担、諸費用、物価変動などは試算に反映していません。";

const klee = Klee_One({ subsets: ["latin"], weight: ["400", "600"] });

type ResultState = {
  projections: LetterProjection[];
  content: LetterContent;
} | null;

type Step = "input" | "loading" | "result";

function formatMan(value: number, suffix = ""): string {
  const man = Math.floor(value / 1000) / 10;
  const formatted = man % 1 === 0 ? `${man.toFixed(0)}` : man.toFixed(1);
  return `${formatted}万円${suffix}`;
}

function normalizeZenkakuDigitsToHankaku(raw: string): string {
  return raw.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30)
  );
}

function sanitizeDigits(raw: string): string {
  const normalized = normalizeZenkakuDigitsToHankaku(raw);
  return normalized.replace(/[^\d]/g, "");
}

function toYenFromManRaw(raw: string, max?: number): number {
  const digits = sanitizeDigits(raw);
  if (!digits) return 0;
  const num = Number(digits);
  if (Number.isNaN(num)) return 0;
  const clamped = typeof max === "number" ? Math.min(num, max) : num;
  return clamped * 10000;
}

const LIFE_EVENT_RANGES = {
  childbirth: { min: 300_000, max: 700_000 },
  moving: { min: 200_000, max: 800_000 },
  car: { min: 1_200_000, max: 3_000_000 }
};

function estimateLifeEventCosts(kidsFuture: number) {
  const kids = Math.max(0, kidsFuture);
  const childbirthMin = LIFE_EVENT_RANGES.childbirth.min * kids;
  const childbirthMax = LIFE_EVENT_RANGES.childbirth.max * kids;
  const movingMin = LIFE_EVENT_RANGES.moving.min;
  const movingMax = LIFE_EVENT_RANGES.moving.max;
  const carMin = LIFE_EVENT_RANGES.car.min;
  const carMax = LIFE_EVENT_RANGES.car.max;
  return {
    childbirthMin,
    childbirthMax,
    movingMin,
    movingMax,
    carMin,
    carMax,
    totalMin: childbirthMin + movingMin + carMin,
    totalMax: childbirthMax + movingMax + carMax
  };
}

export default function LetterFromFutureClient() {
  const [step, setStep] = useState<Step>("input");
  const [form, setForm] = useState<LetterInput>({ ...SAMPLE_INPUT });
  const [moneyInputs, setMoneyInputs] = useState(() => ({
    annual: String(Math.floor(SAMPLE_INPUT.annual_income_jpy / 10000)),
    monthlySavings: String(Math.floor(SAMPLE_INPUT.monthly_savings_jpy / 10000)),
    monthlyInvest: String(Math.floor(SAMPLE_INPUT.monthly_invest_jpy / 10000)),
    currentSavings: String(Math.floor(SAMPLE_INPUT.current_savings_jpy / 10000)),
    currentInvest: String(Math.floor(SAMPLE_INPUT.current_invest_jpy / 10000))
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    hint?: string;
  } | null>(null);
  const [projections, setProjections] = useState<LetterProjection[] | null>(
    null
  );
  const [result, setResult] = useState<ResultState>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [whiteActive, setWhiteActive] = useState(false);
  const [whiteOpaque, setWhiteOpaque] = useState(false);
  const WHITE_IN_MS = 3000;
  const WHITE_OUT_MS = 3000;
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef<number[]>([]);

  const clearPending = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    rafRef.current.forEach((id) => window.cancelAnimationFrame(id));
    timersRef.current = [];
    rafRef.current = [];
  };

  const canSubmit = useMemo(() => {
    return form.age >= 18 && form.age <= 80;
  }, [form.age]);

  const getGoalLabel = (goal: LetterInput["goal"], goalOther?: string) => {
    const map: Record<LetterInput["goal"], string> = {
      entrepreneur: "起業したい",
      fire: "FIREしたい",
      mortgage: "住宅ローン完済",
      overseas: "海外移住",
      other: "その他"
    };
    if (goal === "other" && goalOther) return `その他（${goalOther}）`;
    return map[goal];
  };

  const updateField = (key: keyof LetterInput, value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    clearPending();
    setLoading(true);
    setError(null);
    setStep("loading");
    try {
      const payload: LetterInput = {
        ...form,
        annual_income_jpy: toYenFromManRaw(moneyInputs.annual, 5000),
        monthly_savings_jpy: toYenFromManRaw(moneyInputs.monthlySavings, 200),
        monthly_invest_jpy: toYenFromManRaw(moneyInputs.monthlyInvest, 200),
        current_savings_jpy: toYenFromManRaw(moneyInputs.currentSavings, 20000),
        current_invest_jpy: toYenFromManRaw(moneyInputs.currentInvest, 20000)
      };
      const response = await fetch("/letter-from-future/api/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as LetterApiResponse;
      if (!response.ok || !data.ok) {
        setError({
          message: data.ok ? "Unexpected error." : data.error.message,
          hint: data.ok ? undefined : data.error.hint
        });
        setProjections(data.ok ? null : data.projections ?? null);
        setResult(null);
        setWhiteActive(false);
        setWhiteOpaque(false);
        setLetterOpen(false);
        setModalVisible(false);
        setStep("input");
        return;
      }
      setProjections(data.projections);
      setResult({ projections: data.projections, content: data.content });
      setLetterOpen(false);
      setModalVisible(false);
      setWhiteActive(true);
      setWhiteOpaque(false);
      rafRef.current.push(
        window.requestAnimationFrame(() => setWhiteOpaque(true))
      );
      timersRef.current.push(
        window.setTimeout(() => {
          setStep("result");
          setLetterOpen(true);
        }, WHITE_IN_MS)
      );
    } catch {
      setError({
        message: "通信に失敗しました。時間をおいて再度お試しください。"
      });
      setProjections(null);
      setResult(null);
      setWhiteActive(false);
      setWhiteOpaque(false);
      setLetterOpen(false);
      setModalVisible(false);
      setStep("input");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      setShareCopied(false);
    }
  };

  useEffect(() => {
    if (!letterOpen) {
      setModalVisible(false);
      return;
    }
    const t = requestAnimationFrame(() => setModalVisible(true));
    return () => cancelAnimationFrame(t);
  }, [letterOpen]);

  useEffect(() => {
    return () => clearPending();
  }, []);

  const handleRevealDetails = () => {
    setLetterOpen(false);
    setModalVisible(false);
    setWhiteActive(true);
    setWhiteOpaque(true);
    rafRef.current.push(
      window.requestAnimationFrame(() => setWhiteOpaque(false))
    );
    timersRef.current.push(
      window.setTimeout(() => {
        setWhiteActive(false);
      }, WHITE_OUT_MS)
    );
  };

  if (step === "loading") {
    return (
      <>
        {whiteActive ? (
          <div
            className={`fixed inset-0 z-40 bg-white transition-opacity duration-[3000ms] ${
              whiteOpaque ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : null}
        <div className="card card-outline mx-auto max-w-xl p-10 text-center fade-in">
          <p className="badge">Receiving</p>
          <h2 className="mt-4 text-2xl font-bold">手紙を受け取っています</h2>
          <p className="mt-2 text-sm text-ink/70">
            十年後のあなたから、まもなく届きます。
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-ink/40 [animation-delay:-0.2s]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-ink/60 [animation-delay:-0.1s]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-ink/40" />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {whiteActive ? (
        <div
          className={`fixed inset-0 z-40 bg-white transition-opacity duration-[3000ms] ${
            whiteOpaque ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}
      {letterOpen && result ? (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-white px-4 py-8 transition-opacity duration-[2000ms] ${
            modalVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="w-full max-w-4xl">
            <div
              className={`rounded-3xl border border-ink/15 bg-white p-6 shadow-soft transition-opacity md:p-8 ${klee.className} ${
                modalVisible ? "opacity-100" : "opacity-0"
              }`}
              style={{
                ["--lh" as any]: "36px",
                ["--top" as any]: "20px",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--lh) * 0.84), rgba(15,23,42,0.05) calc(var(--lh) * 0.84), rgba(15,23,42,0.05) calc(var(--lh) * 0.84 + 1px))",
                backgroundSize: "100% var(--lh)",
                backgroundPosition: "0 var(--top)",
                paddingTop: "var(--top)",
                paddingBottom: "32px",
                maxHeight: "72vh",
                overflow: "auto"
              }}
            >
              <p
                className="whitespace-pre-line text-[15px] text-ink/80"
                style={{
                  lineHeight: "var(--lh)"
                }}
              >
                {result.content.letter}
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="btn-primary"
                onClick={handleRevealDetails}
              >
                詳細を見る
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {step === "input" ? (
        <section className="card card-outline p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              あなたの状況を教えてください。
            </h1>
            <p className="mt-2 text-sm text-ink/70">
              ざっくりでもOK。今の状況から未来の様子を少し覗いてみましょう。
            </p>
          </div>
        </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label">年齢</label>
                <input
                  className="input-base"
                  type="number"
                  min={18}
                  max={80}
                  value={form.age}
                  onChange={(event) => updateField("age", Number(event.target.value))}
                />
              </div>
              <div>
                <label className="label">世帯人数（現在）</label>
                <select
                  className="input-base"
                  value={form.household_now}
                  onChange={(event) =>
                    updateField("household_now", Number(event.target.value))
                  }
                >
                  <option value={1}>1人</option>
                  <option value={2}>2人</option>
                  <option value={3}>3人以上</option>
                </select>
              </div>
              <div>
                <label className="label">将来の子ども</label>
                <select
                  className="input-base"
                  value={form.kids_future}
                  onChange={(event) =>
                    updateField("kids_future", Number(event.target.value))
                  }
                >
                  <option value={0}>0人</option>
                  <option value={1}>1人</option>
                  <option value={2}>2人</option>
                  <option value={3}>3人以上</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">世帯年収（万円）</label>
                <input
                  className="input-base"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={moneyInputs.annual}
                  onChange={(event) =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      annual: sanitizeDigits(event.target.value)
                    }))
                  }
                  onBlur={() =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      annual: prev.annual || "0"
                    }))
                  }
                />
                <p className="mt-1 text-xs text-ink/60">
                  {formatMan(toYenFromManRaw(moneyInputs.annual, 5000))}
                </p>
              </div>
              <div>
                <label className="label">人生の目標</label>
                <select
                  className="input-base"
                  value={form.goal}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      goal: event.target.value as LetterInput["goal"]
                    }))
                  }
                >
                  <option value="entrepreneur">起業したい</option>
                  <option value="fire">FIREしたい</option>
                  <option value="mortgage">住宅ローン完済</option>
                  <option value="overseas">海外移住</option>
                  <option value="other">その他</option>
                </select>
              </div>
              {form.goal === "other" ? (
                <div>
                  <label className="label">目標（40文字まで）</label>
                  <input
                    className="input-base"
                    type="text"
                    maxLength={40}
                    value={form.goal_other ?? ""}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        goal_other: event.target.value
                      }))
                    }
                  />
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">毎月の貯蓄（万円）</label>
                <input
                  className="input-base"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={moneyInputs.monthlySavings}
                  onChange={(event) =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      monthlySavings: sanitizeDigits(event.target.value)
                    }))
                  }
                  onBlur={() =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      monthlySavings: prev.monthlySavings || "0"
                    }))
                  }
                />
                <p className="mt-1 text-xs text-ink/60">
                  {formatMan(
                    toYenFromManRaw(moneyInputs.monthlySavings, 200),
                    "/月"
                  )}
                </p>
              </div>
              <div>
                <label className="label">毎月の投資（万円）</label>
                <input
                  className="input-base"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={moneyInputs.monthlyInvest}
                  onChange={(event) =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      monthlyInvest: sanitizeDigits(event.target.value)
                    }))
                  }
                  onBlur={() =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      monthlyInvest: prev.monthlyInvest || "0"
                    }))
                  }
                />
                <p className="mt-1 text-xs text-ink/60">
                  {formatMan(
                    toYenFromManRaw(moneyInputs.monthlyInvest, 200),
                    "/月"
                  )}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">現在の貯蓄（万円）</label>
                <input
                  className="input-base"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={moneyInputs.currentSavings}
                  onChange={(event) =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      currentSavings: sanitizeDigits(event.target.value)
                    }))
                  }
                  onBlur={() =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      currentSavings: prev.currentSavings || "0"
                    }))
                  }
                />
                <p className="mt-1 text-xs text-ink/60">
                  {formatMan(toYenFromManRaw(moneyInputs.currentSavings, 20000))}
                </p>
              </div>
              <div>
                <label className="label">現在の投資残高（万円）</label>
                <input
                  className="input-base"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={moneyInputs.currentInvest}
                  onChange={(event) =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      currentInvest: sanitizeDigits(event.target.value)
                    }))
                  }
                  onBlur={() =>
                    setMoneyInputs((prev) => ({
                      ...prev,
                      currentInvest: prev.currentInvest || "0"
                    }))
                  }
                />
                <p className="mt-1 text-xs text-ink/60">
                  {formatMan(toYenFromManRaw(moneyInputs.currentInvest, 20000))}
                </p>
              </div>
            </div>
          </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? "生成中..." : "手紙を受け取る"}
          </button>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-berry/30 bg-berry/10 p-3 text-sm text-berry">
            <p className="font-semibold">{error.message}</p>
            {error.hint ? (
              <p className="mt-1 text-xs text-berry/80">{error.hint}</p>
            ) : null}
          </div>
        ) : null}
        </section>
      ) : null}

      {step === "result" ? (
        <section className="space-y-4">
          {result ? (
            <div
              className="rounded-3xl border border-ink/15 bg-white p-6 shadow-soft md:p-8"
              style={{
                ["--lh" as any]: "36px",
                ["--top" as any]: "20px",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--lh) * 0.84), rgba(15,23,42,0.05) calc(var(--lh) * 0.84), rgba(15,23,42,0.05) calc(var(--lh) * 0.84 + 1px))",
                backgroundSize: "100% var(--lh)",
                backgroundPosition: "0 var(--top)",
                paddingTop: "var(--top)",
                paddingBottom: "24px"
              }}
            >
              <p
                className={`whitespace-pre-line text-[15px] text-ink/80 ${klee.className}`}
                style={{
                  lineHeight: "var(--lh)"
                }}
              >
                {result.content.letter}
              </p>
            </div>
          ) : null}

          <div className="card card-outline p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">資産予測レンジ</h2>
              <span className="text-xs text-ink/60">
                目標：{getGoalLabel(form.goal, form.goal_other)}
              </span>
            </div>
            <div className="mt-4 grid gap-4">
              {projections?.map((projection) => (
                <div
                  key={projection.years}
                  className="rounded-2xl border border-ink/10 bg-white/70 p-4"
                >
                  <p className="text-sm font-semibold text-ink/70">
                    10年後のレンジ
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-ink/10 bg-white/80 p-3 text-sm">
                      <p className="text-xs font-semibold text-ink/60">資産</p>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between">
                          <span>貯蓄見込み（10年後）</span>
                          <span>
                            {formatMan(projection.savings_future)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>投資（2〜6%）</span>
                          <span>
                            {formatMan(projection.invest_min)}〜
                            {formatMan(projection.invest_max)}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-between rounded-xl border-t border-emerald-200 bg-emerald-50/60 px-2 py-2 text-base font-semibold text-emerald-700">
                          <span>合計</span>
                          <span>
                            {formatMan(projection.total_min)}〜
                            {formatMan(projection.total_max)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white/80 p-3 text-sm">
                      <p className="text-xs font-semibold text-ink/60">支出例</p>
                      <div className="mt-2 space-y-2">
                        {(() => {
                          const costs = estimateLifeEventCosts(form.kids_future);
                          return (
                            <>
                              <div className="flex justify-between">
                                <span>出産（子ども×{form.kids_future}）</span>
                                <span>
                                  {formatMan(costs.childbirthMin)}〜
                                  {formatMan(costs.childbirthMax)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>引越し</span>
                                <span>
                                  {formatMan(costs.movingMin)}〜
                                  {formatMan(costs.movingMax)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>車購入</span>
                                <span>
                                  {formatMan(costs.carMin)}〜
                                  {formatMan(costs.carMax)}
                                </span>
                              </div>
                              <div className="mt-2 flex justify-between rounded-xl border-t border-rose-200 bg-rose-50/70 px-2 py-2 text-base font-semibold text-rose-700">
                                <span>合計目安</span>
                                <span>
                                  {formatMan(costs.totalMin)}〜
                                  {formatMan(costs.totalMax)}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-ink/60">
                    {result?.content.disclaimer || DISCLAIMER_REQUIRED}
                  </p>
                </div>
              ))}
              {!projections ? (
                <div className="rounded-2xl border border-dashed border-ink/20 bg-white/40 p-4 text-sm text-ink/60">
                  未来のレンジはここに表示されます。
                </div>
              ) : null}
            </div>
          </div>

          {result ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="btn-secondary mx-auto rounded-full px-5 py-2 text-sm shadow-soft transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                  onClick={handleShare}
                >
                  {shareCopied ? "コピーしました" : "🔗 結果をシェアする"}
                </button>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white/70 p-4">
                <p className="text-sm font-semibold text-ink">未来を創る三つの方法</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3 text-xs text-ink/70">
                  <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                    <p className="font-semibold text-ink">「貯める工夫」</p>
                    <p className="mt-1 text-ink/60">
                      高金利の預金口座で、自然に貯まる仕組みへ。
                    </p>
                  </div>
                  <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                    <p className="font-semibold text-ink">「賢く使う」</p>
                    <p className="mt-1 text-ink/60">
                      デビット還元で得しつつ、使いすぎを予防。
                    </p>
                  </div>
                  <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                    <p className="font-semibold text-ink">「プロに相談する」</p>
                    <p className="mt-1 text-ink/60">
                      1:1アドバイザーが貯蓄・投資・保険・ライフプランまで。押し売りなし、チャット相談OK。
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border-2 border-ink/20 bg-gradient-to-br from-rose-50 via-amber-50 to-white p-6 text-sm text-ink/70 shadow-md transition hover:shadow-lg md:p-7">
                <p className="font-semibold text-ink">
                  ✨ Habittoと一緒に、理想の十年後を創っていきましょう
                </p>
                <p className="mt-2 leading-relaxed">
                  Habittoアドバイザーチームは、「今」を大切にしながら「未来」に投資し、賢くポジティブに「リスク管理」するあなたのライフプランを全力サポートします！
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <a href="https://registration.habitto.com/ja" className="btn-primary">
                    今すぐ無料で相談する！
                  </a>
                  <a href="https://www.habitto.com/advisor/" className="btn-secondary">
                    相談の流れを見る
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
