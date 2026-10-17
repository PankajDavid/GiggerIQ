import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const TIMEOUT_MS = 25_000;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export interface GeminiImage {
  mimeType: string;
  data: string;
}

/** Single shared Gemini call used by every AI feature. Server-side only. */
export async function generate(system: string, user: string, image?: GeminiImage): Promise<string> {
  const parts: Array<Record<string, unknown>> = [{ text: user }];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });

  const call = getClient().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: { systemInstruction: system, temperature: 0.3, maxOutputTokens: 1024 },
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
  );
  const res = await Promise.race([call, timeout]);
  const text = res.text?.trim();
  if (!text) throw new Error("empty response");
  return text;
}
