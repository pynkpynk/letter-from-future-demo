import type { LetterContent, LetterInput, LetterProjection } from "@/lib/types";
import {
  REQUIRED_HOOK_SENTENCE,
  REQUIRED_METHODS_SENTENCE,
  computeGapSeverity
} from "@/lib/letter/letterRules";

type GoalKey = "entrepreneur" | "fire" | "mortgage" | "overseas" | "other";
type Severity = 0 | 1 | 2 | 3 | 4;
type Situation = "kids" | "pair" | "single";
type CashflowTier = "LOW" | "MID" | "HIGH";
type StabilityTier = "LOW" | "MID" | "HIGH";
type LifeLoadTier = "LIGHT" | "MID" | "HEAVY";
type EndingGroup = "ne" | "kana" | "kamo" | "nanda" | "tte" | "toOmou";

type Sentence = { text: string; ending: EndingGroup };

const GOAL_CODE: Record<GoalKey, number> = {
  entrepreneur: 1,
  fire: 2,
  mortgage: 3,
  overseas: 4,
  other: 5
};

const LINE4_BY_SEVERITY: string[][] = [
  [
    "今の暮らしは落ち着いてて、次の選択も焦らず進められる感じ。",
    "生活は落ち着いてて、次の選択に迷いが少ないかな。",
    "生活は安定してるし、進め方も見えてる感じ。"
  ],
  [
    "生活は保ててるけど、少し整える余地はあるかも。",
    "生活は続いてるけど、見直せるところが残ってるね。",
    "生活は保ててるし、整えるともう少し楽になりそう。"
  ],
  [
    "生活は続いてるけど、負担がじわっと積もってる感じ。",
    "生活は回ってるけど、余裕のなさを感じるね。",
    "普段は回ってるけど、ふとしたときにしんどくなる日もあるんだ。"
  ],
  [
    "生活はギリギリで、選択肢が狭く感じるんだ。",
    "生活は厳しくて、調整が必要だと感じる。",
    "生活は苦しくて、立て直しを急ぎたい感じ。"
  ],
  [
    "生活はかなり厳しくて、今のままだと持たない気がするんだ。",
    "生活は苦しくて、早めの調整が必要だと思う。",
    "生活はしんどくて、今のままだと続かない気がする。"
  ]
];

const PLAN_BY_GOAL: Record<
  GoalKey,
  { save: string; grow: string; protect: string; cta: string }
> = {
  entrepreneur: {
    save: "挑戦のための余白を先に確保する",
    grow: "未来の選択肢を増やす習慣を整える",
    protect: "不安が出ても戻れる土台を持つ",
    cta: "一度プロと話して、挑戦に向けた準備を整えよう。"
  },
  fire: {
    save: "穏やかな時間を守るために余白を作る",
    grow: "増やし方の癖をやさしく整える",
    protect: "安心が続く仕組みを持つ",
    cta: "一度プロと話して、穏やかな未来への準備を整えよう。"
  },
  mortgage: {
    save: "住まいの安心に向けて余白を作る",
    grow: "進め方のクセをやさしく整える",
    protect: "安心が続く土台を持つ",
    cta: "一度プロと話して、住まいの安心に向けた準備を整えよう。"
  },
  overseas: {
    save: "移動のための余白を先に確保する",
    grow: "選択肢が広がる整え方を持つ",
    protect: "変化に強い土台を持つ",
    cta: "一度プロと話して、移動の未来に向けた準備を整えよう。"
  },
  other: {
    save: "余白を先に確保する",
    grow: "増やし方の癖を整える",
    protect: "安心が続く土台を持つ",
    cta: "一度プロと話して、理想の十年後に向けた準備を整えよう。"
  }
};

const DENYLIST_PATTERN =
  /(ねかな|かなかも|かなって感じ|かもかな|感じるなんだ|んだって感じ|ねって感じ)/;

function makeSentence(text: string, ending: EndingGroup): Sentence {
  return { text, ending };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickSituation(input: LetterInput): Situation {
  if (input.kids_future > 0) return "kids";
  if (input.household_now >= 2) return "pair";
  return "single";
}

function goalKeyword(input: LetterInput): string {
  if (input.goal === "other") return input.goal_other?.trim() || "目標";
  if (input.goal === "fire") return "FIRE";
  if (input.goal === "mortgage") return "住宅ローン完済";
  if (input.goal === "entrepreneur") return "起業";
  if (input.goal === "overseas") return "海外移住";
  return "目標";
}

function computeCashflowTier(projection?: LetterProjection | null): CashflowTier {
  if (!projection) return "MID";
  const high = projection.monthly_surplus_est_high ?? 0;
  if (high <= 0) return "LOW";
  if (high <= 30000) return "MID";
  return "HIGH";
}

function computeStabilityTier(
  input: LetterInput,
  projection?: LetterProjection | null
): StabilityTier {
  if (!projection) return "MID";
  const buffer =
    (input.current_savings_jpy + input.current_invest_jpy) /
    Math.max(1, projection.monthly_spending_est_10y);
  if (buffer < 3) return "LOW";
  if (buffer < 6) return "MID";
  return "HIGH";
}

function computeLifeLoadTier(input: LetterInput): LifeLoadTier {
  const score = input.kids_future * 2 + Math.max(0, input.household_now - 1);
  if (score <= 1) return "LIGHT";
  if (score <= 4) return "MID";
  return "HEAVY";
}

function buildScenarioKey(input: LetterInput, projection?: LetterProjection | null): string {
  const cash = computeCashflowTier(projection);
  const stability = computeStabilityTier(input, projection);
  const load = computeLifeLoadTier(input);
  return `${cash}-${stability}-${load}`;
}

function severityBand(severity: Severity): "calm" | "caution" | "strained" {
  if (severity <= 1) return "calm";
  if (severity === 2) return "caution";
  return "strained";
}

function line2Pool(
  situation: Situation,
  severity: Severity,
  scenarioKey: string
): Sentence[] {
  const band = severityBand(severity);
  const pool: Sentence[] = [];

  if (situation === "kids") {
    if (band === "calm") {
      pool.push(
        makeSentence("子どもとの時間が増えて、家のリズムも穏やかだね。", "ne"),
        makeSentence("家の予定は動くけど、家族のペースは保ててるかな。", "kana"),
        makeSentence("子ども中心でも、気持ちは少し落ち着いてきたかも。", "kamo")
      );
    } else if (band === "caution") {
      pool.push(
        makeSentence("子どもの予定に振り回されやすくて、家がバタつく日もあるね。", "ne"),
        makeSentence("家のペースは保ってるけど、余裕はまだ少なめかな。", "kana"),
        makeSentence("子どものことで疲れが残りやすいかも。", "kamo")
      );
    } else {
      pool.push(
        makeSentence("子どものことで毎日が手一杯で、家の余裕がほとんどないね。", "ne"),
        makeSentence("家の中がバタバタで、落ち着く時間が取れないかな。", "kana"),
        makeSentence("子どものことで気持ちも削られがちかも。", "kamo")
      );
    }
  }

  if (situation === "pair") {
    if (band === "calm") {
      pool.push(
        makeSentence("ふたりの暮らしが安定してて、日々のリズムは整ってるね。", "ne"),
        makeSentence("ふたりの生活は落ち着いてきて、気持ちも軽いかな。", "kana"),
        makeSentence("ふたりの時間は保てて、暮らしも穏やかかも。", "kamo")
      );
    } else if (band === "caution") {
      pool.push(
        makeSentence("ふたりの暮らしは続いてるけど、余裕はまだ少なめね。", "ne"),
        makeSentence("ふたりの生活は回ってるけど、整えたい所があるかな。", "kana"),
        makeSentence("ふたりの時間はあるけど、気持ちは詰まりやすいかも。", "kamo")
      );
    } else {
      pool.push(
        makeSentence("ふたりの暮らしは続いてるけど、余裕が削られてるね。", "ne"),
        makeSentence("ふたりの生活が回ってても、息が詰まりやすいかな。", "kana"),
        makeSentence("ふたりの時間はあるけど、しんどい日が増えたかも。", "kamo")
      );
    }
  }

  if (situation === "single") {
    if (band === "calm") {
      pool.push(
        makeSentence("ひとりの暮らしが整って、気持ちもゆるやかだね。", "ne"),
        makeSentence("ひとりの生活は落ち着いてて、ペースも合ってるかな。", "kana"),
        makeSentence("ひとりの時間は守れて、気持ちも軽くなったかも。", "kamo")
      );
    } else if (band === "caution") {
      pool.push(
        makeSentence("ひとりの暮らしは続いてるけど、余裕が減りやすいね。", "ne"),
        makeSentence("ひとりの生活は回ってるけど、見直したい所があるかな。", "kana"),
        makeSentence("ひとりの時間はあるけど、疲れが残りやすいかも。", "kamo")
      );
    } else {
      pool.push(
        makeSentence("ひとりの暮らしが続いてても、余裕がほとんどないね。", "ne"),
        makeSentence("ひとりの生活は回ってるけど、気持ちが重くなるかな。", "kana"),
        makeSentence("ひとりの時間はあるけど、しんどさが続くかも。", "kamo")
      );
    }
  }

  if (scenarioKey.startsWith("LOW-LOW")) {
    pool.push(
      makeSentence("やりくりに追われて、落ち着かない日が増えたんだ。", "nanda"),
      makeSentence("少しの変化でも気持ちが揺れやすいと思う。", "toOmou")
    );
  }

  if (scenarioKey.startsWith("HIGH-HIGH")) {
    pool.push(
      makeSentence("日々の流れは落ち着いていて、気持ちも整ってるね。", "ne"),
      makeSentence("暮らしは安定してるし、心の余裕も出てきたかな。", "kana")
    );
  }

  return pool;
}

function line3Pool(
  input: LetterInput,
  severity: Severity,
  scenarioKey: string
): Sentence[] {
  const goal = input.goal as GoalKey;
  const keyword = goalKeyword(input);
  const band = severityBand(severity);
  const pool: Sentence[] = [];

  const addGoal = (text: string, ending: EndingGroup) =>
    pool.push(makeSentence(text.replace("{goal}", keyword), ending));

  if (goal === "entrepreneur") {
    if (band === "calm") {
      addGoal("{goal}の準備が進んで、形が見えてきたね。", "ne");
      addGoal("{goal}は動き出してて、手応えも出てきたかな。", "kana");
      addGoal("{goal}の道が少しずつ固まってきたかも。", "kamo");
    } else if (band === "caution") {
      addGoal("{goal}は意識できてるけど、揺れる日もあるね。", "ne");
      addGoal("{goal}の段取りは見えてきたけど、余裕は少なめかな。", "kana");
      addGoal("{goal}に向けて動いてるけど、不安も残るかも。", "kamo");
    } else {
      addGoal("{goal}はまだ遠くて、動きが止まりそうな日もあるね。", "ne");
      addGoal("{goal}に向けて進みたいけど、足元がしんどいかな。", "kana");
      addGoal("{goal}の準備は続けてるけど、揃ってない感じかも。", "kamo");
    }
  }

  if (goal === "fire") {
    if (band === "calm") {
      addGoal("{goal}の準備が進んで、安心感が出てきたね。", "ne");
      addGoal("{goal}は動き出してて、手応えも出てきたかな。", "kana");
      addGoal("{goal}の道が少しずつ固まってきたかも。", "kamo");
    } else if (band === "caution") {
      addGoal("{goal}は意識できてるけど、揺れる日もあるね。", "ne");
      addGoal("{goal}の段取りは見えてきたけど、余裕は少なめかな。", "kana");
      addGoal("{goal}に向けて動いてるけど、不安も残るかも。", "kamo");
    } else {
      addGoal("{goal}はまだ遠くて、気持ちが焦る日もあるね。", "ne");
      addGoal("{goal}に向けて進みたいけど、足元がしんどいかな。", "kana");
      addGoal("{goal}の準備は続けてるけど、揃ってない感じかも。", "kamo");
    }
  }

  if (goal === "mortgage") {
    if (band === "calm") {
      addGoal("{goal}が見えてきて、気持ちが落ち着くね。", "ne");
      addGoal("{goal}に向けた動きは続いてて、あと少しかな。", "kana");
      addGoal("{goal}の道が少しずつ固まってきたかも。", "kamo");
    } else if (band === "caution") {
      addGoal("{goal}は意識できてるけど、揺れる日もあるね。", "ne");
      addGoal("{goal}の段取りは見えてきたけど、余裕は少なめかな。", "kana");
      addGoal("{goal}に向けて動いてるけど、不安も残るかも。", "kamo");
    } else {
      addGoal("{goal}はまだ遠くて、気持ちが焦る日もあるね。", "ne");
      addGoal("{goal}に向けて進みたいけど、足元がしんどいかな。", "kana");
      addGoal("{goal}の準備は続けてるけど、揃ってない感じかも。", "kamo");
    }
  }

  if (goal === "overseas") {
    if (band === "calm") {
      addGoal("{goal}の準備が進んで、見通しがよくなったね。", "ne");
      addGoal("{goal}は動き出してて、あと少しかな。", "kana");
      addGoal("{goal}の道が少しずつ固まってきたかも。", "kamo");
    } else if (band === "caution") {
      addGoal("{goal}は意識できてるけど、揺れる日もあるね。", "ne");
      addGoal("{goal}の段取りは見えてきたけど、余裕は少なめかな。", "kana");
      addGoal("{goal}に向けて動いてるけど、不安も残るかも。", "kamo");
    } else {
      addGoal("{goal}はまだ遠くて、気持ちが焦る日もあるね。", "ne");
      addGoal("{goal}に向けて進みたいけど、足元がしんどいかな。", "kana");
      addGoal("{goal}の準備は続けてるけど、揃ってない感じかも。", "kamo");
    }
  }

  if (goal === "other") {
    const intent = inferOtherGoalIntent(input.goal_other ?? "");
    const label = `「${intent.keyword}」`;
    if (band === "calm") {
      pool.push(
        makeSentence(`${label}に向けて動きが出てきて、手応えもあるね。`, "ne"),
        makeSentence(`${label}は動き出してて、あと少しかな。`, "kana"),
        makeSentence(`${label}の道が少しずつ固まってきたかも。`, "kamo")
      );
    } else if (band === "caution") {
      pool.push(
        makeSentence(`${label}は意識できてるけど、揺れる日もあるね。`, "ne"),
        makeSentence(`${label}の段取りは見えてきたけど、余裕は少なめかな。`, "kana"),
        makeSentence(`${label}に向けて動いてるけど、不安も残るかも。`, "kamo")
      );
    } else {
      pool.push(
        makeSentence(`${label}はまだ遠くて、気持ちが焦る日もあるね。`, "ne"),
        makeSentence(`${label}に向けて進みたいけど、足元がしんどいかな。`, "kana"),
        makeSentence(`${label}の準備は続けてるけど、揃ってない感じかも。`, "kamo")
      );
    }
  }

  if (scenarioKey.startsWith("LOW-LOW")) {
    pool.push(
      makeSentence("目標には向かってるけど、余裕のなさが引っかかるんだ。", "nanda"),
      makeSentence("目標への動きはあるけど、足元が不安だと思う。", "toOmou")
    );
  }

  return pool;
}

function pickSentence(
  pool: Sentence[],
  seed: number,
  avoidEnding?: EndingGroup
): Sentence {
  if (pool.length === 0) return makeSentence("", "ne");
  for (let i = 0; i < pool.length; i += 1) {
    const candidate = pool[(seed + i) % pool.length];
    if (avoidEnding && candidate.ending === avoidEnding) continue;
    return candidate;
  }
  return pool[seed % pool.length];
}

function pickLine2Line3(
  line2PoolData: Sentence[],
  line3PoolData: Sentence[],
  seed: number
): { line2: Sentence; line3: Sentence } {
  const line2 = pickSentence(line2PoolData, seed);
  const line2Text = line2.text;
  for (let i = 0; i < line3PoolData.length; i += 1) {
    const candidate = line3PoolData[(seed + 3 + i) % line3PoolData.length];
    if (candidate.ending === line2.ending) continue;
    if (DENYLIST_PATTERN.test(`${line2Text}${candidate.text}`)) continue;
    return { line2, line3: candidate };
  }
  const fallback = pickSentence(line3PoolData, seed + 7, line2.ending);
  return { line2, line3: fallback };
}

function buildLine4(severity: Severity, variant: 0 | 1 | 2): string {
  const variants = LINE4_BY_SEVERITY[severity] ?? LINE4_BY_SEVERITY[1];
  return variants[variant % variants.length];
}

function sanitizeKeyword(raw: string): string {
  const cleaned = raw.replace(/[0-9０-９%％円月]/g, "").trim();
  if (!cleaned) return "目標";
  return cleaned.slice(0, 18);
}

function inferOtherGoalIntent(goalOther: string): {
  keyword: string;
  category: "travel" | "career" | "home" | "health" | "dream" | "skill" | "other";
  difficulty: 1 | 2 | 3;
} {
  const raw = sanitizeKeyword(goalOther);
  const text = raw.toLowerCase();
  if (/(旅行|世界一周|世界旅行|海外|backpack)/.test(raw)) {
    return { keyword: raw || "目標", category: "travel", difficulty: 2 };
  }
  if (/(起業|独立|副業|転職|フリーランス)/.test(raw)) {
    return { keyword: raw || "目標", category: "career", difficulty: 2 };
  }
  if (/(家|マイホーム|引っ越し|引越し)/.test(raw)) {
    return { keyword: raw || "目標", category: "home", difficulty: 2 };
  }
  if (/(筋トレ|ダイエット|健康)/.test(raw)) {
    return { keyword: raw || "目標", category: "health", difficulty: 1 };
  }
  if (/(資格|勉強|語学|スキル|学び)/.test(raw)) {
    return { keyword: raw || "目標", category: "skill", difficulty: 1 };
  }
  if (/(宇宙|火星|ロケット|億|F1)/i.test(text)) {
    return { keyword: raw || "目標", category: "dream", difficulty: 3 };
  }
  return { keyword: raw || "目標", category: "other", difficulty: 2 };
}

export function pickTemplateVariant(input: LetterInput): 0 | 1 | 2 {
  const seed =
    input.age * 31 +
    input.household_now * 7 +
    input.kids_future * 13 +
    GOAL_CODE[input.goal as GoalKey] * 17;
  return (seed % 3) as 0 | 1 | 2;
}

export function buildTemplateLetterVariant(
  input: LetterInput,
  variant: 0 | 1 | 2,
  projection?: LetterProjection | null,
  severityOverride?: Severity
): string {
  const severityBase =
    typeof severityOverride === "number"
      ? severityOverride
      : computeGapSeverity({ input, projection });
  const scenarioKey = buildScenarioKey(input, projection);
  const situation = pickSituation(input);
  const otherIntent =
    input.goal === "other"
      ? inferOtherGoalIntent(input.goal_other ?? "")
      : null;
  const severity =
    otherIntent && input.goal === "other"
      ? (Math.min(4, severityBase + (otherIntent.difficulty - 1)) as Severity)
      : severityBase;

  const line2PoolData = line2Pool(situation, severity, scenarioKey);
  const line3PoolData = line3Pool(input, severity, scenarioKey);
  const seed = hashString(`${scenarioKey}:${input.goal}:${variant}:${severity}`);
  const { line2, line3 } = pickLine2Line3(line2PoolData, line3PoolData, seed);
  const line4 = buildLine4(severity, variant);

  return [
    "十年前のキミへ。",
    line2.text,
    line3.text,
    line4,
    REQUIRED_HOOK_SENTENCE,
    REQUIRED_METHODS_SENTENCE,
    "十年後のキミより。"
  ].join("\n");
}

export function buildTemplateLetter(
  input: LetterInput,
  projection?: LetterProjection | null,
  severityOverride?: Severity
): string {
  return buildTemplateLetterVariant(
    input,
    pickTemplateVariant(input),
    projection,
    severityOverride
  );
}

export function buildTemplateContent(
  input: LetterInput,
  projection?: LetterProjection | null,
  severityOverride?: Severity
): LetterContent {
  const plan = PLAN_BY_GOAL[input.goal as GoalKey] ?? PLAN_BY_GOAL.other;
  return {
    letter: buildTemplateLetter(input, projection, severityOverride),
    plan_save: plan.save,
    plan_grow: plan.grow,
    plan_protect: plan.protect,
    cta: plan.cta,
    summary: "",
    disclaimer: ""
  };
}
