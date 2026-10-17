import { describe, expect, it } from "vitest";
import { computeTotals, parseStoredEarnings } from "@/lib/earnings";
import { askSchema, hasValidImageSignature } from "@/lib/validation";
import { selectSchemes, verifyCitations, SCHEMES } from "@/lib/schemes";

describe("earnings", () => {
  it("computes totals and per-hour rate", () => {
    const t = computeTotals([
      { id: "1", date: "2026-10-01", platform: "Swiggy", amount: 800, hours: 8 },
      { id: "2", date: "2026-10-02", platform: "Uber", amount: 1200, hours: 6 },
    ]);
    expect(t).toEqual({ totalAmount: 2000, totalHours: 14, perHour: 142.86 });
  });

  it("handles zero hours without dividing by zero", () => {
    expect(computeTotals([]).perHour).toBe(0);
  });

  it("drops tampered localStorage data", () => {
    expect(parseStoredEarnings('[{"id":"x","amount":"<script>"}]')).toEqual([]);
    expect(parseStoredEarnings("not json")).toEqual([]);
  });
});

describe("request validation", () => {
  it("rejects oversized text and unknown modes", () => {
    expect(askSchema.safeParse({ mode: "complaint", lang: "en", text: "a".repeat(1001) }).success).toBe(false);
    expect(askSchema.safeParse({ mode: "hack", lang: "en", text: "hello" }).success).toBe(false);
  });

  it("requires an image for document mode", () => {
    expect(askSchema.safeParse({ mode: "document", lang: "hi", text: "" }).success).toBe(false);
  });

  it("checks real image bytes, not the declared type", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(hasValidImageSignature("image/png", png)).toBe(true);
    expect(hasValidImageSignature("image/jpeg", png)).toBe(false);
  });
});

describe("scheme grounding", () => {
  it("selects relevant schemes server-side", () => {
    const ids = selectSchemes("I want a pension for old age").map((s) => s.id);
    expect(ids).toContain("pmsym");
  });

  it("rejects answers citing schemes that were not provided", () => {
    const allowed = SCHEMES.filter((s) => s.id === "pmsym");
    expect(verifyCitations("Answer\nSOURCES: pmsym", allowed).ok).toBe(true);
    expect(verifyCitations("Answer\nSOURCES: fakescheme", allowed).ok).toBe(false);
    expect(verifyCitations("Answer with no sources line", allowed).ok).toBe(false);
  });
});
