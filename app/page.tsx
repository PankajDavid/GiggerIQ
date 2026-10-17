"use client";

import { useEffect, useMemo, useState } from "react";
import { computeTotals, earningSchema, parseStoredEarnings, MAX_ENTRIES, type Earning } from "@/lib/earnings";
import { T, MODE_LABELS } from "@/lib/i18n";
import type { Lang, Mode } from "@/lib/validation";

const STORAGE_KEY = "giggeriq-earnings";
type AskMode = Exclude<Mode, "earnings">;
interface AskResult { answer?: string; error?: string; sources?: { name: string; link: string }[] }

async function askGiggerIQ(payload: object): Promise<AskResult> {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as AskResult;
  } catch {
    return { error: "Network problem. Please try again." };
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Answer({ result, lang }: { result: AskResult | null; lang: Lang }) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  if (result.error) return <p className="error" role="alert">{result.error}</p>;
  const t = T[lang];
  return (
    <div className="card" aria-live="polite">
      {/* Rendered as plain text: React escapes it, never HTML. */}
      <p className="answer">{result.answer}</p>
      {result.sources && result.sources.length > 0 && (
        <>
          <p><strong>{t.sources}:</strong></p>
          <ul>
            {result.sources.map((s) => (
              <li key={s.link + s.name}>
                <a href={s.link} target="_blank" rel="noopener noreferrer">{s.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        className="secondary"
        onClick={() => {
          navigator.clipboard?.writeText(result.answer ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}

function EarningsTab({ lang }: { lang: Lang }) {
  const t = T[lang];
  const today = new Date().toISOString().slice(0, 10);
  const [entries, setEntries] = useState<Earning[]>([]);
  const [form, setForm] = useState({ date: today, platform: "", amount: "", hours: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  useEffect(() => {
    try { setEntries(parseStoredEarnings(localStorage.getItem(STORAGE_KEY))); } catch { /* storage blocked */ }
  }, []);

  const persist = (next: Earning[]) => {
    setEntries(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  };

  const totals = useMemo(() => computeTotals(entries), [entries]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = earningSchema.safeParse({
      id: editingId ?? crypto.randomUUID(),
      date: form.date,
      platform: form.platform,
      amount: Number(form.amount),
      hours: Number(form.hours),
    });
    if (!candidate.success) {
      setFormError(candidate.error.issues[0]?.message ?? "Invalid entry");
      return;
    }
    if (!editingId && entries.length >= MAX_ENTRIES) {
      setFormError(`Limit of ${MAX_ENTRIES} entries reached`);
      return;
    }
    setFormError("");
    const next = editingId
      ? entries.map((x) => (x.id === editingId ? candidate.data : x))
      : [...entries, candidate.data];
    persist(next.sort((a, b) => a.date.localeCompare(b.date)));
    setEditingId(null);
    setForm({ date: today, platform: "", amount: "", hours: "" });
  };

  const startEdit = (x: Earning) => {
    setEditingId(x.id);
    setForm({ date: x.date, platform: x.platform, amount: String(x.amount), hours: String(x.hours) });
  };

  const analyse = async () => {
    setBusy(true);
    setResult(await askGiggerIQ({ mode: "earnings", lang, entries }));
    setBusy(false);
  };

  return (
    <>
      <form className="card" onSubmit={submit} noValidate>
        <label htmlFor="date">{t.date}</label>
        <input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <label htmlFor="platform">{t.platform}</label>
        <input id="platform" maxLength={40} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} required />
        <label htmlFor="amount">{t.amount}</label>
        <input id="amount" type="number" inputMode="decimal" min={0} max={100000} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        <label htmlFor="hours">{t.hours}</label>
        <input id="hours" type="number" inputMode="decimal" min={0} max={24} step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
        {formError && <p className="error" role="alert">{formError}</p>}
        <div className="row">
          <button type="submit">{editingId ? t.save : t.add}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm({ date: today, platform: "", amount: "", hours: "" }); }}>
              {t.cancel}
            </button>
          )}
        </div>
        <p className="muted">{t.storedNote}</p>
      </form>

      <section className="card" aria-label={t.total}>
        <div className="totals">
          <div><span className="muted">{t.total}</span><strong>Rs {totals.totalAmount}</strong></div>
          <div><span className="muted">{t.totalHours}</span><strong>{totals.totalHours}</strong></div>
          <div><span className="muted">{t.perHour}</span><strong>Rs {totals.perHour}</strong></div>
        </div>
        {entries.length === 0 ? (
          <p className="muted">{t.noEntries}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {entries.map((x) => (
              <li key={x.id} className="entry">
                <span>{x.date} · {x.platform} · Rs {x.amount} · {x.hours}h</span>
                <span className="row" style={{ marginTop: 0 }}>
                  <button className="secondary" onClick={() => startEdit(x)} aria-label={`${t.edit} ${x.date} ${x.platform}`}>{t.edit}</button>
                  <button className="secondary" onClick={() => persist(entries.filter((y) => y.id !== x.id))} aria-label={`${t.del} ${x.date} ${x.platform}`}>{t.del}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <button onClick={analyse} disabled={busy || entries.length === 0}>{busy ? t.thinking : t.analyse}</button>
        </div>
      </section>
      <Answer result={result} lang={lang} />
    </>
  );
}

function AskTab({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [mode, setMode] = useState<AskMode>("complaint");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    let image: { mimeType: string; data: string } | undefined;
    if (mode === "document") {
      if (!file) { setResult({ error: t.photo }); setBusy(false); return; }
      if (file.size > 4 * 1024 * 1024) { setResult({ error: "Image must be under 4 MB." }); setBusy(false); return; }
      image = { mimeType: file.type, data: await fileToBase64(file) };
    }
    setResult(await askGiggerIQ({ mode, lang, text, image }));
    setBusy(false);
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="muted">{t.ask}</legend>
          <div className="modes">
            {(Object.keys(MODE_LABELS[lang]) as AskMode[]).map((m) => (
              <button type="button" key={m} className="secondary" aria-pressed={mode === m} onClick={() => { setMode(m); setResult(null); }}>
                {MODE_LABELS[lang][m]}
              </button>
            ))}
          </div>
        </fieldset>
        {mode === "document" && (
          <>
            <label htmlFor="photo">{t.photo}</label>
            <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </>
        )}
        <label htmlFor="question">{t.question}</label>
        <textarea id="question" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="muted">{t.privacy}</p>
        <div className="row">
          <button type="submit" disabled={busy}>{busy ? t.thinking : t.send}</button>
        </div>
      </form>
      <Answer result={result} lang={lang} />
    </>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [tab, setTab] = useState<"earnings" | "ask">("ask");
  const t = T[lang];

  return (
    <main lang={lang}>
      <header>
        <div>
          <h1>GiggerIQ</h1>
          <p className="tagline">{t.tagline}</p>
        </div>
        <div>
          <label htmlFor="lang" className="muted" style={{ margin: 0 }}>{t.language}</label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        <button className="secondary" aria-pressed={tab === "ask"} onClick={() => setTab("ask")}>{t.ask}</button>
        <button className="secondary" aria-pressed={tab === "earnings"} onClick={() => setTab("earnings")}>{t.earnings}</button>
      </nav>
      {tab === "ask" ? <AskTab lang={lang} /> : <EarningsTab lang={lang} />}
    </main>
  );
}
