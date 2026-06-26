import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import type { RAGResponse } from "../lib/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CitationBadge } from "../components/CitationBadge";
import { ConfidenceIndicator } from "../components/ConfidenceIndicator";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RagPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`${API_URL}/rag/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), k: 4 }),
      });
      if (r.status === 422) {
        setError("Question was rejected by validation — it may be too short or too long (max 500 chars).");
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
      setResult((await r.json()) as RAGResponse);
    } catch {
      setError("Could not reach the backend. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading && question.trim()) submit();
  }

  return (
    <>
      <Head>
        <title>RAG — Cited Answer · M10</title>
      </Head>
      <div className="min-h-screen bg-cream dark:bg-charcoal">
        <main className="max-w-4xl mx-auto px-8 py-12">

          {/* Back nav */}
          <nav className="mb-10">
            <Link
              href="/"
              className="text-sm text-warm-gray hover:text-sage dark:hover:text-saffron transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-saffron rounded"
            >
              ← Back to demos
            </Link>
          </nav>

          {/* Hero */}
          <header className="mb-10 animate-slide-up">
            <span className="inline-block mb-3 px-2.5 py-1 rounded-md bg-saffron/20 text-saffron-dark dark:text-saffron font-mono text-xs font-bold tracking-wide">
              RAG
            </span>
            <h1 className="font-display text-4xl font-bold text-charcoal dark:text-cream mb-3">
              Cited Recipe Answer
            </h1>
            <p className="text-warm-gray dark:text-warm-gray-light max-w-xl">
              Ask any recipe question. The answer is grounded in the corpus and every
              claim is backed by a numbered citation.
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
                placeholder="e.g. How do I prep ginger for stir-fry?"
                maxLength={500}
                aria-label="Recipe question"
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
                size="md"
              >
                {loading ? "Asking…" : "Ask"}
              </Button>
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

          {/* Empty state */}
          {!loading && !result && !error && (
            <div className="text-center py-20 text-warm-gray dark:text-warm-gray-light animate-fade-in">
              <p className="text-5xl mb-4" aria-hidden="true">🍜</p>
              <p className="font-display text-lg font-semibold text-charcoal/50 dark:text-cream/40">
                Your answer will appear here
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading answer">
              <div className="h-4 bg-warm-gray/20 rounded w-3/4" />
              <div className="h-4 bg-warm-gray/20 rounded w-full" />
              <div className="h-4 bg-warm-gray/20 rounded w-5/6" />
              <div className="h-4 bg-warm-gray/20 rounded w-2/3" />
            </div>
          )}

          {/* Result */}
          {result && (
            <article className="space-y-6 animate-slide-up">

              {/* Answer */}
              <Card variant="highlight">
                <h2 className="text-xs font-mono font-bold text-warm-gray dark:text-warm-gray-light uppercase tracking-widest mb-3">
                  Answer
                </h2>
                <p
                  data-testid="rag-answer"
                  className="text-charcoal dark:text-cream leading-relaxed"
                >
                  {result.answer}
                  {result.citations.length > 0 && (
                    <span className="ml-2 inline-flex gap-1">
                      {result.citations.map((c, i) => (
                        <CitationBadge key={c.chunk_id} citation={c} index={i} />
                      ))}
                    </span>
                  )}
                </p>
              </Card>

              {/* Confidence */}
              <Card>
                <ConfidenceIndicator value={result.confidence} />
              </Card>

              {/* Citations */}
              {result.citations.length > 0 && (
                <Card>
                  <h2 className="text-xs font-mono font-bold text-warm-gray dark:text-warm-gray-light uppercase tracking-widest mb-4">
                    Citations ({result.citations.length})
                  </h2>
                  <ul className="space-y-3 list-none p-0">
                    {result.citations.map((c, i) => (
                      <li
                        key={c.chunk_id}
                        className="flex items-start gap-3 text-sm"
                      >
                        <CitationBadge citation={c} index={i} />
                        <span className="text-warm-gray dark:text-warm-gray-light font-mono pt-0.5">
                          Chunk <strong className="text-charcoal dark:text-cream">#{c.chunk_id}</strong>
                          {" · "}score{" "}
                          <strong className="text-charcoal dark:text-cream">{c.score.toFixed(3)}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {result.citations.length === 0 && (
                <p className="text-sm text-warm-gray dark:text-warm-gray-light italic">
                  No citations were retrieved for this answer.
                </p>
              )}
            </article>
          )}
        </main>
      </div>
    </>
  );
}
