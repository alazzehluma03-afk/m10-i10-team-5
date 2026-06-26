import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import type { KGResponse, UnsupportedQueryDetail } from "../lib/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function KgPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<KGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setSupported(null);
    setResult(null);
    try {
      const r = await fetch(`${API_URL}/kg/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      if (r.status === 422) {
        const body = await r.json();
        const detail = body.detail as UnsupportedQueryDetail | undefined;
        if (detail?.reason === "unsupported_question") {
          setError("That question pattern isn't supported. Try one of these:");
          setSupported(detail.supported_patterns);
        } else {
          setError("The request was rejected by validation.");
        }
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
      setResult((await r.json()) as KGResponse);
    } catch {
      setError("Could not reach the backend. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading && question.trim()) submit();
  }

  const columns = result?.rows.length
    ? Object.keys(result.rows[0])
    : [];

  return (
    <>
      <Head>
        <title>Knowledge Graph · M10</title>
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
              KG
            </span>
            <h1 className="font-display text-4xl font-bold text-charcoal dark:text-cream mb-3">
              Recipe Knowledge Graph
            </h1>
            <p className="text-warm-gray dark:text-warm-gray-light max-w-xl">
              Query the Neo4j recipe graph with natural language. Pattern-matched to
              Cypher and executed live.
            </p>
          </header>

          {/* Form */}
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="mb-8 animate-fade-in"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Find Sichuan recipes"
                maxLength={500}
                aria-label="Knowledge graph question"
                className={[
                  "flex-1 rounded-lg border px-4 py-2.5",
                  "bg-cream dark:bg-charcoal-light",
                  "text-charcoal dark:text-cream",
                  "placeholder:text-warm-gray",
                  "transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-saffron focus:border-transparent",
                  "border-warm-gray/50 dark:border-warm-gray-dark",
                ].join(" ")}
              />
              <Button
                type="submit"
                loading={loading}
                disabled={!question.trim()}
              >
                {loading ? "Querying…" : "Ask"}
              </Button>
            </div>
          </form>

          {/* Error + supported patterns */}
          {error && (
            <Card variant="error" className="mb-8 animate-fade-in">
              <p role="alert" data-testid="error" className="text-red-700 dark:text-red-400 text-sm mb-3">
                {error}
              </p>
              {supported && (
                <ul
                  data-testid="supported-patterns"
                  className="list-none p-0 space-y-1"
                >
                  {supported.map((p, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => { setQuestion(p); setError(null); setSupported(null); }}
                        className="text-sm font-mono text-sage dark:text-saffron hover:underline focus:outline-none focus:ring-1 focus:ring-saffron rounded text-left"
                      >
                        → {p}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Querying graph">
              {[70, 90, 60, 80].map((w, i) => (
                <div key={i} className="h-8 bg-warm-gray/20 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !result && !error && (
            <div className="text-center py-20 text-warm-gray animate-fade-in">
              <p className="text-5xl mb-4" aria-hidden="true">🕸️</p>
              <p className="font-display text-lg font-semibold text-charcoal/50 dark:text-cream/40">
                Graph results will appear here
              </p>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <section className="space-y-6 animate-slide-up">

              {/* Cypher */}
              <Card>
                <h2 className="text-xs font-mono font-bold text-warm-gray dark:text-warm-gray-light uppercase tracking-widest mb-3">
                  Generated Cypher
                </h2>
                <pre className="font-mono text-sm text-charcoal dark:text-cream bg-cream-dark dark:bg-charcoal/60 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                  {result.cypher}
                </pre>
              </Card>

              {/* Rows */}
              <div>
                <h2 className="text-xs font-mono font-bold text-warm-gray dark:text-warm-gray-light uppercase tracking-widest mb-4">
                  Rows ({result.count})
                </h2>
                {result.count === 0 ? (
                  <Card>
                    <p className="text-warm-gray dark:text-warm-gray-light text-sm italic">
                      No rows returned for this query.
                    </p>
                  </Card>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-warm-gray/20 dark:border-warm-gray-dark/30">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-cream-dark dark:bg-charcoal-light border-b border-warm-gray/20 dark:border-warm-gray-dark/30">
                          {columns.map((col) => (
                            <th key={col} className="px-4 py-3 text-left font-semibold text-charcoal dark:text-cream">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-warm-gray/10 dark:divide-warm-gray-dark/20">
                        {result.rows.map((row, i) => (
                          <tr
                            key={i}
                            data-testid="kg-row"
                            className="bg-cream dark:bg-charcoal hover:bg-cream-dark dark:hover:bg-charcoal-light transition-colors duration-150"
                          >
                            {columns.map((col) => (
                              <td key={col} className="px-4 py-3 text-charcoal dark:text-cream font-mono text-xs">
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
