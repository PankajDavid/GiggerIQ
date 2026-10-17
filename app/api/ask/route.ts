import { NextRequest, NextResponse } from "next/server";
import { askSchema, hasValidImageSignature, MAX_IMAGE_BYTES } from "@/lib/validation";
import { checkLimit } from "@/lib/rateLimit";
import { selectSchemes, verifyCitations } from "@/lib/schemes";
import { buildPrompt } from "@/lib/prompts";
import { generate } from "@/lib/gemini";

export const runtime = "nodejs";

const BUSY = "GiggerIQ is busy right now. Please try again in a minute.";
const DONT_KNOW =
  "I don't know based on the verified scheme information I have. Please check https://eshram.gov.in or visit your nearest Common Service Centre.";

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: "Request not allowed." }, 403);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkLimit(ip);
  if (limit !== "ok") return reply({ error: BUSY }, 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return reply({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  }
  const input = parsed.data;

  if (input.image) {
    const bytes = Buffer.from(input.image.data, "base64");
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      return reply({ error: "Image must be under 4 MB." }, 400);
    }
    if (!hasValidImageSignature(input.image.mimeType, bytes)) {
      return reply({ error: "Please upload a real JPG, PNG or WebP photo." }, 400);
    }
  }

  const schemes = input.mode === "schemes" ? selectSchemes(input.text) : [];
  if (input.mode === "schemes" && schemes.length === 0) {
    return reply({ answer: DONT_KNOW, sources: [] });
  }

  try {
    const { system, user } = buildPrompt(input, schemes);
    const raw = await generate(system, user, input.mode === "document" ? input.image : undefined);

    if (input.mode === "schemes") {
      const checked = verifyCitations(raw, schemes);
      if (!checked.ok) return reply({ answer: DONT_KNOW, sources: [] });
      return reply({
        answer: checked.text,
        sources: checked.cited.map((s) => ({ name: s.name, link: s.link })),
      });
    }
    return reply({ answer: raw, sources: [] });
  } catch {
    // No user text or image is logged.
    console.error(`ask failed: mode=${input.mode}`);
    return reply({ error: BUSY }, 503);
  }
}
