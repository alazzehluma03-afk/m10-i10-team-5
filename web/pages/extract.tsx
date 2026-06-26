import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import type { ExtractResponse } from "../lib/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const LABEL_COLORS: Record<string, string> = {
  PERSON: "bg-sage/15 text-sage-dark dark:bg-sage-dark/30 dark:text-sage-light border-sage/30",
  ORG: "bg-saffron/15 text-saffron-dark dark:bg-saffron-dark/30 dark:text-saffron border-saffron/30",
  GPE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200",
  DATE: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200",
  PRODUCT: "bg-warm-gray/15 text-warm-gray-dark dark:bg-warm-gray-dark/20 dark:text-warm-gray-light border-warm-gray/30",
};

function labelClass(label: string): string {
  return LABEL_COLORS[label] ?? "bg-warm-gray/10 text-charcoal dark:text-cream border-warm-gray/20";
}

export default function ExtractPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`${API_URL}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (r.status === 422) {
        setError("Text was rejected — it must be between 1 and 5 000 characters.");
        return;
      }
      if (r.status === 503) {
        setError("The backend is still loading. Wait a moment and try again.");
        return;
      }
      if (!r.ok) {
        setError(`Unexpected error (HTTP ${r.status}). Please try again.`);
        return;
      }
      setResult((await r.json()) as ExtractResponse);
    } catch {
      setError("Could not reach the backend. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Extract Entities · M10</title>
      </Head>
      <div className="min-h-screen bg-cream dark:bg-charcoal">
        <main className="max-w-4xl mx-auto px-8 py-12">

          <nav className="mb-10">
            <Link
              href="/"
              className="text-sm text-warm-gray hover:text-sage dark:hover:text-saffron transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-saffron rounded"
            >
              ← Back to demos
            </Link>
          </nav>

          <header className="mb-10 animate-slide-up">
            <span className="inline-block mb-3 px-2.5 py-1 rounded-md bg-saffron/20 text-saffron-dark dark:text-saffron font-mono text-xs font-bold tracking-wide">
              NER
            </span>
            <h1 className="font-display text-4xl font-bold text-charcoal dark:text-cream mb-3">
              Extract Entities
            </h1>
            <p className="text-warm-gray dark:text-warm-gray-light max-w-xl">
              Paste any text to identify named entities: people, places, dates,
              organisations, and more via spaCy.
            </p>
          </header>

          {/* Form */}
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="mb-8 space-y-4 animate-fade-in"
          >
            <label htmlFor="extract-input" className="block text-sm font-medium text-charcoal dark:text-cream">
              Text to analyse
            </label>
            <textarea
              id="extract-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste text to extract named entities from…"
              rows={6}
              maxLength={5000}
              aria-label="Text to extract entities from"
              className={[
                "w-full rounded-lg border px-4 py-3 resize-y",
                "bg-cream dark:bg-charcoal-light",
                "text-charcoal dark:text-cream",
                "placeholder:text-warm-gray",
                "transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-saffron focus:border-transparent",
                "border-warm-gray/50 dark:border-warm-gray-dark",
              ].join(" ")}
            />
            <div className="flex items-center justify-between">
              <Button
                type="submit"
                loading={loading}
                disabled={!text.trim()}
              >
                {loading ? "Extracting…" : "Extract"}
              </Button>
              <span className="text-xs text-warm-gray font-mono">
                {text.length} / 5 000
              </span>
            </div>
          </form>

          {/* Error */}
          {error && (
            <Card variant="error" className="mb-8 animate-fade-in">
              <p role="alert" data-testid="error" className="text-red-700 dark:text-red-400 text-sm">
                {error}
              </p>
            </Card>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Extracting entities">
              {[80, 60, 90, 50].map((w, i) => (
                <div key={i} className={`h-8 bg-warm-gray/20 rounded`} style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <section className="animate-slide-up">
              <h2 className="text-xs font-mono font-bold text-warm-gray dark:text-warm-gray-light uppercase tracking-widest mb-4">
                Entities found ({result.entities.length})
              </h2>

              {result.entities.length === 0 ? (
                <Card>
                  <p className="text-warm-gray dark:text-warm-gray-light text-sm italic">
                    No named entities found in this text.
                  </p>
                </Card>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-warm-gray/20 dark:border-warm-gray-dark/30">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cream-dark dark:bg-charcoal-light border-b border-warm-gray/20 dark:border-warm-gray-dark/30">
                        <th className="px-4 py-3 text-left font-semibold text-charcoal dark:text-cream">Text</th>
                        <th className="px-4 py-3 text-left font-semibold text-charcoal dark:text-cream">Label</th>
                        <th className="px-4 py-3 text-left font-semibold text-charcoal dark:text-cream font-mono">Start</th>
                        <th className="px-4 py-3 text-left font-semibold text-charcoal dark:text-cream font-mono">End</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-gray/10 dark:divide-warm-gray-dark/20">
                      {result.entities.map((e, i) => (
                        <tr
                          key={i}
                          data-testid="entity-span"
                          className="bg-cream dark:bg-charcoal hover:bg-cream-dark dark:hover:bg-charcoal-light transition-colors duration-150"
                        >
                          <td className="px-4 py-3 font-medium text-charcoal dark:text-cream">
                            {e.text}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs font-mono font-bold ${labelClass(e.label)}`}>
                              {e.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-warm-gray dark:text-warm-gray-light">{e.start}</td>
                          <td className="px-4 py-3 font-mono text-warm-gray dark:text-warm-gray-light">{e.end}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </>
  );
}
