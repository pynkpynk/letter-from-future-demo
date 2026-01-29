import test from "node:test";
import assert from "node:assert/strict";
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
  buildThreeMethods
} from "@/lib/letter/letterRules";

test("hasForbiddenLetterTerms flags forbidden words", () => {
  assert.equal(hasForbiddenLetterTerms("レンジ"), true);
  assert.equal(hasForbiddenLetterTerms("二人以上"), true);
  assert.equal(hasForbiddenLetterTerms("Habitto"), true);
  assert.equal(hasForbiddenLetterTerms("安心"), false);
});

test("hasProhibitedLetterPhrases flags account phrases", () => {
  assert.equal(hasProhibitedLetterPhrases("口座開設"), true);
  assert.equal(hasProhibitedLetterPhrases("相談してみよう"), false);
});

test("letter requires あの日の準備 and rejects 今日の準備", () => {
  assert.equal(hasRequiredHookPhrase(REQUIRED_HOOK_SENTENCE), true);
  assert.equal(hasRequiredHookPhrase("十年後の安心は、準備にかかってた。"), false);
  assert.equal(hasProhibitedLetterPhrases("今日の準備にかかってる"), true);
});

test("line 4 must be a single sentence", () => {
  const ok = [
    "十年前のキミへ。",
    "生活は落ち着いている。",
    "目標に向けて動いている。",
    "生活は保てているが、見直す余地がある。",
    REQUIRED_HOOK_SENTENCE,
    REQUIRED_METHODS_SENTENCE,
    "十年後のキミより。"
  ].join("\n");
  const ng = [
    "十年前のキミへ。",
    "生活は落ち着いている。",
    "目標に向けて動いている。",
    "生活は保てている。見直す余地がある。",
    REQUIRED_HOOK_SENTENCE,
    REQUIRED_METHODS_SENTENCE,
    "十年後のキミより。"
  ].join("\n");
  assert.equal(hasSingleSentenceLine4(ok), true);
  assert.equal(hasSingleSentenceLine4(ng), false);
});

test("required hook/methods lines and line count", () => {
  const ok = [
    "十年前のキミへ。",
    "生活は落ち着いている。",
    "目標に向けて動いている。",
    "生活は保てているが、見直す余地がある。",
    REQUIRED_HOOK_SENTENCE,
    REQUIRED_METHODS_SENTENCE,
    "十年後のキミより。"
  ].join("\n");
  assert.equal(hasSevenLines(ok), true);
  assert.equal(hasRequiredLine5Hook(ok), true);
  assert.equal(hasRequiredLine6Methods(ok), true);
});

test("three_methods titles are wrapped by Japanese quotes", () => {
  const methods = buildThreeMethods();
  const quoted = /^「.+」$/;
  for (const method of methods) {
    assert.equal(quoted.test(method.title), true);
  }
});

test("friendly ending heuristic matches common endings", () => {
  const friendly = /だよ。|かな。|みよう。|かも。|と思う。/;
  assert.equal(friendly.test("やってみよう。"), true);
  assert.equal(friendly.test("完了。"), false);
});
