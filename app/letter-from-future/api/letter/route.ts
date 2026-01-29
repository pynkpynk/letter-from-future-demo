import { NextResponse } from "next/server";
import { computeProjections } from "@/lib/projections";
import { generateStructuredJson } from "@/lib/openai";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseLetterInput } from "@/lib/validation";
import type { LetterApiResponse, LetterContent } from "@/lib/types";
import {
  REQUIRED_HOOK_SENTENCE,
  REQUIRED_METHODS_SENTENCE,
  buildThreeMethods,
  computeGapSeverity,
  hasForbiddenLetterTerms,
  hasProhibitedLetterPhrases,
  hasRequiredHookPhrase,
  hasRequiredLine5Hook,
  hasRequiredLine6Methods,
  hasSevenLines,
  hasSingleSentenceLine4
} from "@/lib/letter/letterRules";
import {
  buildTemplateContent,
  pickTemplateVariant
} from "@/lib/letter/templateLetter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCLAIMER_TEXT =
  "※支出例の他、ケガ・病気・住宅などの大きな支出、公的負担、諸費用、物価変動などは試算に反映していません。";
const EVIDENCE_SUMMARY = [
  "出典: 家計調査2024(総務省)の月間支出ベース",
  "支出/余力/ランウェイは入力と平均値から簡易推定",
  "未来を整える三つの方法がある"
];
const EVIDENCE_DETAILS =
  "家計調査2024の二人以上世帯・月間消費支出 300,243円を基準に世帯人数で調整し、手取り比率(75-85%)から余力とランウェイを推定しています。三つの方法: 預金金利0.5%(税引後0.398%)・100万円超は0.2%(税引後0.159%)、デビット還元0.8%、FP相談(チャット/ビデオ)無料。";

const LIMITS = {
  letter: 320,
  plan: 60,
  cta: 200,
  disclaimer: 90,
  total: 600
};
const LLM_TIMEOUT_MS = 8000;
const POLISH_TIMEOUT_MS = 2000;
const polishCache = new Map<string, string>();
function countChars(text: string): number {
  return Array.from(text).length;
}

function normalizeLetter(text: string): string {
  let lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 7) {
    while (lines.length < 7) lines.push("");
  }
  if (lines.length > 7) {
    lines = lines.slice(0, 7);
  }

  lines[0] = "十年前のキミへ。";
  lines[6] = "十年後のキミより。";

  lines = lines.map((line) =>
    line
      .replaceAll("今日の準備にかかってる", "")
      .replaceAll("今日の準備にかかっている", "")
      .replaceAll("今日の準備にかかってた", "")
      .replaceAll("今日の準備にかかっていた", "")
      .replaceAll("今日の準備", "")
      .replaceAll("十年後の安心は、あの日の準備にかかってた。", "")
      .replaceAll(REQUIRED_HOOK_SENTENCE, "")
      .replaceAll(REQUIRED_METHODS_SENTENCE, "")
      .trim()
  );

  if (!lines[4]) lines[4] = "";
  if (!lines[5]) lines[5] = "";

  lines[4] = REQUIRED_HOOK_SENTENCE;
  lines[5] = REQUIRED_METHODS_SENTENCE;

  const line4 = lines[3] ?? "";
  const count = (line4.match(/。/g) ?? []).length;
  if (count > 1) {
    const parts = line4.split("。");
    const last = parts.pop();
    lines[3] = `${parts.filter(Boolean).join("、")}、${last}`.replace(
      /、?$/,
      "。"
    );
  } else if (count === 0 && line4) {
    lines[3] = `${line4}。`;
  }

  return lines.join("\n").trim();
}

function describeLetterViolations(letter: string): string[] {
  const issues: string[] = [];
  const digitCheck = letter.replace(REQUIRED_METHODS_SENTENCE, "");
  if (/[0-9０-９%％円]/.test(digitCheck)) issues.push("digits_or_symbols");
  if (hasForbiddenLetterTerms(letter)) issues.push("forbidden_terms");
  if (hasProhibitedLetterPhrases(letter)) issues.push("prohibited_phrases");
  if (!hasRequiredHookPhrase(letter)) issues.push("missing_hook");
  if (!hasRequiredLine5Hook(letter)) issues.push("line5_not_hook");
  if (!hasRequiredLine6Methods(letter)) issues.push("line6_not_methods");
  if (!hasSingleSentenceLine4(letter)) issues.push("line4_not_single");
  if (!hasSevenLines(letter)) issues.push("line_count");
  if (!letter.startsWith("十年前のキミへ。")) issues.push("start_line");
  if (!letter.endsWith("十年後のキミより。")) issues.push("end_line");
  return issues;
}

function validateContent(content: LetterContent): { ok: true } | { ok: false } {
  const fields = [
    content.letter,
    content.plan_save,
    content.plan_grow,
    content.plan_protect,
    content.cta,
    content.disclaimer
  ];

  const digitCheck = content.letter.replace(REQUIRED_METHODS_SENTENCE, "");
  if (/[0-9０-９%％円]/.test(digitCheck)) return { ok: false };
  if (hasForbiddenLetterTerms(content.letter)) return { ok: false };
  if (hasProhibitedLetterPhrases(content.letter)) return { ok: false };
  if (!hasRequiredHookPhrase(content.letter)) return { ok: false };
  if (!hasRequiredLine5Hook(content.letter)) return { ok: false };
  if (!hasRequiredLine6Methods(content.letter)) return { ok: false };
  if (!hasSingleSentenceLine4(content.letter)) return { ok: false };
  if (!hasSevenLines(content.letter)) return { ok: false };

  if (countChars(content.letter) > LIMITS.letter) return { ok: false };
  if (countChars(content.plan_save) > LIMITS.plan) return { ok: false };
  if (countChars(content.plan_grow) > LIMITS.plan) return { ok: false };
  if (countChars(content.plan_protect) > LIMITS.plan) return { ok: false };
  if (countChars(content.cta) > LIMITS.cta) return { ok: false };
  if (countChars(content.disclaimer) > LIMITS.disclaimer) return { ok: false };

  const total = fields.reduce((sum, field) => sum + countChars(field), 0);
  if (total > LIMITS.total) return { ok: false };

  return { ok: true };
}

function normalizeDisclaimer(text: string): string {
  if (
    text.includes("大きな出費") &&
    text.includes("税金") &&
    text.includes("インフレ")
  ) {
    return text;
  }
  return DISCLAIMER_TEXT;
}

function goalLabel(goal: string, goalOther?: string): string {
  const map: Record<string, string> = {
    entrepreneur: "起業",
    fire: "FIRE",
    mortgage: "住宅ローン完済",
    overseas: "海外移住",
    other: "その他"
  };
  const base = map[goal] ?? goal;
  return goal === "other" && goalOther ? `${base}(${goalOther})` : base;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function buildConsultMemo(input: {
  goal: string;
  goal_other?: string;
  projection: ReturnType<typeof computeProjections>[number];
}): string {
  const { projection } = input;
  return [
    `目標: ${goalLabel(input.goal, input.goal_other)} / ギャップ: ${projection.goal_gap_label}`,
    `10年レンジ: ${formatNumber(projection.total_min)}〜${formatNumber(projection.total_max)}円`,
    `支出推定: ${formatNumber(projection.monthly_spending_est_10y)}円/月 余力: ${formatNumber(
      projection.monthly_surplus_est_low
    )}〜${formatNumber(projection.monthly_surplus_est_high)}円/月`,
    `採用積立: ${formatNumber(
      projection.used_monthly_total_low
    )}〜${formatNumber(projection.used_monthly_total_high)}円/月 ランウェイ: ${formatNumber(
      projection.runway_months_min
    )}〜${formatNumber(projection.runway_months_max)}ヶ月`
  ].join(" / ");
}

function buildPrompt(payload: Record<string, unknown>): string {
  return `以下の条件で日本語の短い未来レターを作成してください。数値計算は不要（すでに計算済み）です。\n\n【入力】\n${JSON.stringify(
    payload,
    null,
    2
  )}\n\n【出力要件】\n- JSONのみで出力する。余計な文字は入れない。\n- 必須キー: letter, plan_save, plan_grow, plan_protect, cta, summary, disclaimer\n- letter <= 320文字、plan_* <= 60文字、cta <= 200文字、disclaimer <= 90文字\n- 合計600文字以内\n- goalの意味: entrepreneur=起業, fire=FIRE, mortgage=住宅ローン完済, overseas=海外移住, other=その他(goal_other参照)\n- 十年後の自分が十年前の自分に書く口調\n- letterは必ず「十年前のキミへ。」で始まり「十年後のキミより。」で終える\n- 7行構成にする\n- 2行目は生活の様子、3行目は目標進捗（目標の語を必ず入れる）\n- 4行目は1文のみで、状況のまとめを書く\n- 5行目は次の文言をそのまま使う: ${REQUIRED_HOOK_SENTENCE}\n- 6行目は次の文言をそのまま使う: ${REQUIRED_METHODS_SENTENCE}\n- 「今日の準備にかかってる」などの旧フレーズは本文に入れない\n- letterには金額・%・数値を入れない（数字・円・%・範囲などを避ける）\n- 禁止語: レンジ/比率/%/上限/税引/円/万円/月/年収/手取り/家計調査/消費支出/二人以上/Habitto\n- 抽象的・文学的な比喩を避け、日常の言葉で書く\n- 2〜4行目の語尾は「よ。」を使わない\n- ブランド名は本文に一切出さない\n- 断定を避け、優しいトーン\n- 具体的な商品名や投資指図はNG。一般的な表現のみ\n- 大きな出費、税金・手数料、インフレは未考慮と明示する\n- summaryは相談用メモ（数値入り、目標とギャップ、10年レンジ、支出推定、余力レンジ、採用積立額、runwayを短文で）\n- disclaimerは次の文言をベースにすること: ${DISCLAIMER_TEXT}\n`;
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<LetterApiResponse>(
      {
        ok: false,
        error: { message: "Invalid JSON body.", code: "invalid_json" }
      },
      { status: 400 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json<LetterApiResponse>(
      {
        ok: false,
        error: { message: "Too many requests.", code: "rate_limited" }
      },
      {
        status: 429,
        headers: { "Retry-After": rate.retryAfter.toString() }
      }
    );
  }

  const parsed = parseLetterInput(body);
  if (!parsed.ok) {
    return NextResponse.json<LetterApiResponse>(
      {
        ok: false,
        error: { message: parsed.message, code: parsed.code }
      },
      { status: parsed.status }
    );
  }

  const projections = computeProjections(parsed.data);

  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json<LetterApiResponse>(
      {
        ok: false,
        projections,
        error: {
          message: "OPENAI_API_KEY is not set.",
          code: "missing_api_key",
          hint: "Set OPENAI_API_KEY in .env.local and restart the dev server."
        }
      },
      { status: 500 }
    );
  }

  try {
    const model =
      (process.env.OPENAI_MODEL ?? "gpt-5-mini").trim() || "gpt-5-mini";
    const promptData = {
      goal: parsed.data.goal,
      goal_other: parsed.data.goal_other ?? null,
      gap_severity: computeGapSeverity({
        input: parsed.data,
        projection: projections[0]
      }),
      goal_gap_label: projections[0].goal_gap_label,
      surplus_band:
        projections[0].monthly_surplus_est_high === 0
          ? "small"
          : projections[0].monthly_surplus_est_high < 50000
          ? "small"
          : projections[0].monthly_surplus_est_high < 100000
          ? "medium"
          : "large",
      runway_band:
        projections[0].runway_months_max < 6
          ? "short"
          : projections[0].runway_months_max < 12
          ? "ok"
          : "long",
      is_invest_zero:
        parsed.data.monthly_invest_jpy === 0 &&
        parsed.data.current_invest_jpy === 0,
      household_now_label:
        parsed.data.household_now === 1 ? "ひとり" : "家族",
      household_future_label:
        parsed.data.household_now + parsed.data.kids_future <= 1
          ? "ひとり"
          : "家族"
    };
    const prompt = buildPrompt(promptData);
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        letter: { type: "string" },
        plan_save: { type: "string" },
        plan_grow: { type: "string" },
        plan_protect: { type: "string" },
        cta: { type: "string" },
        summary: { type: "string" },
        disclaimer: { type: "string" }
      },
      required: [
        "letter",
        "plan_save",
        "plan_grow",
        "plan_protect",
        "cta",
        "summary",
        "disclaimer"
      ]
    };

    const llmStart = Date.now();
    let llmMs = 0;
    let retryCount = 0;
    let usedFallback = false;
    let content: LetterContent | null = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const gapSeverity = computeGapSeverity({
        input: parsed.data,
        projection: projections[0]
      });
      const base = buildTemplateContent(parsed.data, projections[0], gapSeverity);
      const baseLetter = normalizeLetter(base.letter);
      const variant = pickTemplateVariant(parsed.data);
      const otherKey =
        parsed.data.goal === "other"
          ? (parsed.data.goal_other ?? "").trim()
          : "";
      const cacheKey = `${parsed.data.age}:${parsed.data.household_now}:${parsed.data.kids_future}:${parsed.data.goal}:${otherKey}:${variant}:${gapSeverity}`;
      const cached = polishCache.get(cacheKey);
      if (cached) {
        content = { ...base, letter: normalizeLetter(cached) };
      } else {
        const polishSchema = {
          type: "object",
          additionalProperties: false,
          properties: { letter: { type: "string" } },
          required: ["letter"]
        };
        const polishPrompt = `以下の7行レターの2〜3行目だけ、やわらかく言い換えてください。1行目/4行目/5行目/6行目/7行目は一字一句変えないでください。\n\n【固定条件】\n- 1行目は「十年前のキミへ。」\n- 4行目は1文で、必ず「。」で終える\n- 5行目は「${REQUIRED_HOOK_SENTENCE}」\n- 6行目は「${REQUIRED_METHODS_SENTENCE}」\n- 7行目は「十年後のキミより。」\n- 2行目と3行目の語尾は重ねない（ね。/かな。/って感じ。/かも。/なんだ。/と思う。を使い分ける）\n- 語尾の重なり（ねかな/かなかも/ねって感じ/感じるなんだ/んだって感じ等）を作らない\n- 2〜3行目は「よ。」を使わない\n- 2行目は生活の様子、3行目は目標進捗（目標の語を必ず入れる）\n- gapSeverity=${gapSeverity}（0=穏やか,4=かなり厳しい）。指定より明るくしない\n- goalがotherの場合はgoal_otherの意味を汲み、難易度とgapSeverityに合わせて距離感を表現する\n- 禁止語: レンジ/比率/%/上限/税引/円/万円/月/年収/手取り/家計調査/消費支出/二人以上/Habitto/今日の準備\n- 使わない表現: いるが/だが/欠ける/追いつかない/息の詰まる/見えるけど\n- 数字や記号は入れない\n- 口語で、日常の言葉に寄せる（ちょっと/なんとなく/少し/って感じ などはOK）\n\n【元のレター】\n${baseLetter}\n\nJSONのみで出力。キーはletterのみ。`;
        const polishController = new AbortController();
        const polishTimeout = setTimeout(
          () => polishController.abort(),
          POLISH_TIMEOUT_MS
        );
        try {
          const polishResult = await generateStructuredJson({
            model,
            system:
              "You are a careful Japanese copywriter. Output JSON only.",
            user: polishPrompt,
            schema: polishSchema,
            signal: polishController.signal
          });
          const polishText = polishResult.rawText;
          if (!polishText) throw new Error("empty_output");
          const parsedPolish = JSON.parse(polishText) as { letter: string };
          const polished = normalizeLetter(parsedPolish.letter);
          if (
            hasForbiddenLetterTerms(polished) ||
            hasProhibitedLetterPhrases(polished) ||
            !hasRequiredHookPhrase(polished) ||
            !hasRequiredLine5Hook(polished) ||
            !hasRequiredLine6Methods(polished) ||
            !hasSingleSentenceLine4(polished) ||
            !hasSevenLines(polished)
          ) {
            throw new Error("polish_invalid");
          }
          polishCache.set(cacheKey, polished);
          content = { ...base, letter: polished };
        } catch {
          usedFallback = true;
          content = { ...base, letter: baseLetter };
        } finally {
          clearTimeout(polishTimeout);
        }
      }
    } catch {
      usedFallback = true;
      content = {
        ...buildTemplateContent(parsed.data, projections[0]),
        disclaimer: DISCLAIMER_TEXT
      };
    } finally {
      clearTimeout(timeoutId);
      llmMs = Date.now() - llmStart;
    }
    if (!content) {
      usedFallback = true;
      content = {
        ...buildTemplateContent(parsed.data, projections[0]),
        disclaimer: DISCLAIMER_TEXT
      };
    }

    content.disclaimer = normalizeDisclaimer(content.disclaimer);
    content.summary = buildConsultMemo({
      goal: parsed.data.goal,
      goal_other: parsed.data.goal_other,
      projection: projections[0]
    });
    content.evidence_summary = EVIDENCE_SUMMARY;
    content.evidence_details = EVIDENCE_DETAILS;
    content.evidence = `${EVIDENCE_SUMMARY.join("\n")}\n${EVIDENCE_DETAILS}`;
    content.three_methods = buildThreeMethods();

    console.info("[timing]", {
      llm_ms: llmMs,
      retry_count: retryCount,
      fallback: usedFallback
    });

    return NextResponse.json<LetterApiResponse>({
      ok: true,
      projections,
      content
    });
  } catch (error) {
    const err = error as {
      status?: number;
      code?: string;
      type?: string;
      param?: string;
      name?: string;
      message?: string;
      error?: { code?: string; type?: string; param?: string; message?: string };
      headers?: Record<string, string>;
      response?: { headers?: Record<string, string>; status?: number };
      request_id?: string;
      cause?: { message?: string };
    };
    if (err?.code === "sdk_incompatible") {
      return NextResponse.json<LetterApiResponse>(
        {
          ok: false,
          projections,
          error: {
            message: "OpenAI SDK missing expected methods.",
            code: "sdk_incompatible",
            status: null,
            request_id: null,
            upstream_code: null,
            upstream_type: null,
            upstream_param: null,
            upstream_message: null,
            name: err.name ?? "Error",
            detail:
              typeof err?.message === "string" ? err.message.slice(0, 200) : null,
            model:
              (process.env.OPENAI_MODEL ?? "gpt-5-mini").trim() || "gpt-5-mini",
            hint: "Upgrade the OpenAI SDK to a version that supports Responses API."
          }
        },
        { status: 500 }
      );
    }
    const status =
      typeof err?.status === "number"
        ? err.status
        : typeof err?.response?.status === "number"
        ? err.response.status
        : null;
    const requestId =
      typeof err?.request_id === "string"
        ? err.request_id
        : typeof err?.headers?.["x-request-id"] === "string"
        ? err.headers["x-request-id"]
        : null;
    const upstreamCode = err?.error?.code ?? err?.code ?? null;
    const upstreamType = err?.error?.type ?? err?.type ?? null;
    const upstreamParam = err?.error?.param ?? err?.param ?? null;
    const upstreamMessage =
      typeof err?.error?.message === "string"
        ? err.error.message.slice(0, 200)
        : typeof err?.message === "string"
        ? err.message.slice(0, 200)
        : typeof err?.cause?.message === "string"
        ? err.cause.message.slice(0, 200)
        : null;
    const detail =
      typeof err?.message === "string"
        ? err.message.slice(0, 200)
        : typeof err?.cause?.message === "string"
        ? err.cause.message.slice(0, 200)
        : null;
    const name = typeof err?.name === "string" ? err.name : "Error";
    const model =
      (process.env.OPENAI_MODEL ?? "gpt-5-mini").trim() || "gpt-5-mini";
    const hint =
      status === 401
        ? "Check OPENAI_API_KEY is valid and restart the server."
        : status === 403 || status === 404 || upstreamCode === "model_not_found"
        ? `Project may not have access to model ${model}.`
        : status === 429
        ? "Rate limit or quota exceeded; try again later."
        : status && status >= 500
        ? "Upstream temporary issue; retry shortly."
        : "Likely local runtime/SDK error. See error.detail.";

    console.error("[openai_error]", {
      status,
      request_id: requestId,
      upstream_code: upstreamCode,
      upstream_type: upstreamType,
      name,
      detail_head: detail,
      model
    });

    return NextResponse.json<LetterApiResponse>(
      {
        ok: false,
        projections,
        error: {
          message: "OpenAI request failed.",
          code: "openai_error",
          status,
          request_id: requestId,
          upstream_code: upstreamCode ?? null,
          upstream_type: upstreamType ?? null,
          upstream_param: upstreamParam ?? null,
          upstream_message: upstreamMessage ?? null,
          name,
          detail: detail ?? null,
          model,
          hint
        }
      },
      { status: 500 }
    );
  }
}
