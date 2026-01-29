import OpenAI from "openai/index.mjs";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function generateStructuredJson({
  model,
  system,
  user,
  schema,
  signal
}: {
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{ rawText: string; usedChatFallback: boolean }> {
  const openai = getOpenAIClient() as any;
  const hasResponses = typeof openai?.responses?.create === "function";
  const hasChat = typeof openai?.chat?.completions?.create === "function";

  if (hasResponses) {
    const response = await openai.responses.create({
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      signal,
      text: {
        format: {
          type: "json_schema",
          name: "letter_from_future",
          strict: true,
          schema
        }
      }
    });
    return { rawText: response.output_text ?? "", usedChatFallback: false };
  }

  if (hasChat) {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user }
    ];
    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        signal,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "letter_from_future",
            strict: true,
            schema
          }
        }
      });
      return {
        rawText: response?.choices?.[0]?.message?.content ?? "",
        usedChatFallback: true
      };
    } catch (error) {
      const err = error as any;
      const status = typeof err?.status === "number" ? err.status : null;
      const message =
        typeof err?.error?.message === "string"
          ? err.error.message
          : typeof err?.message === "string"
          ? err.message
          : "";
      if (
        status === 400 ||
        message.includes("json_schema") ||
        message.includes("response_format") ||
        message.includes("structured")
      ) {
        const fallbackUser = `${user}\n\n出力はJSONのみ。Markdownは禁止。`;
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: fallbackUser }
          ],
          signal,
          response_format: { type: "json_object" }
        });
        return {
          rawText: response?.choices?.[0]?.message?.content ?? "",
          usedChatFallback: true
        };
      }
      throw error;
    }
  }

  const err = new Error(
    "OpenAI SDK missing expected methods (responses/chat)."
  ) as Error & { code?: string };
  err.code = "sdk_incompatible";
  throw err;
}
