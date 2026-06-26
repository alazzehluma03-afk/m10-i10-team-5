import Link from "next/link";
import Head from "next/head";

interface DemoCard {
  href: string;
  title: string;
  description: string;
  badge: string;
}

const demos: DemoCard[] = [
  {
    href: "/extract",
    title: "Extract entities",
    description: "Named entity recognition — paste any text and identify people, places, ingredients, and more.",
    badge: "NER",
  },
  {
    href: "/kg",
    title: "Query the recipe knowledge graph",
    description: "Ask natural-language questions answered by a Neo4j graph of recipes, cuisines, and techniques.",
    badge: "KG",
  },
  {
    href: "/rag",
    title: "Ask a recipe question (RAG)",
    description: "Retrieval-augmented generation — get a cited answer grounded in the recipe corpus.",
    badge: "RAG",
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>M10 Recipe Service</title>
        <meta name="description" content="Recipe knowledge service with NER, Knowledge Graph, and RAG" />
      </Head>
      <div className="min-h-screen bg-cream dark:bg-charcoal">
        <main className="max-w-4xl mx-auto px-8 py-16">
          {/* Hero */}
          <header className="mb-16 animate-slide-up">
            <p className="text-saffron font-mono text-sm font-medium tracking-widest uppercase mb-3">
              Integration 10 · M10 Lab
            </p>
            <h1 className="font-display text-5xl font-bold text-charcoal dark:text-cream leading-tight mb-4">
              Recipe Knowledge<br />Service
            </h1>
            <p className="text-warm-gray dark:text-warm-gray-light text-lg max-w-xl">
              Three ways to explore a recipe corpus — entity extraction, graph queries,
              and retrieval-augmented generation with cited answers.
            </p>
          </header>

          {/* Demo cards */}
          <ul className="grid gap-6 sm:grid-cols-3 list-none p-0 animate-fade-in">
            {demos.map((d) => (
              <li key={d.href}>
                <Link href={d.href} className="group block h-full">
                  <div className="h-full rounded-xl border border-warm-gray/20 dark:border-warm-gray-dark/30 bg-cream dark:bg-charcoal-light p-6 transition-all duration-200 shadow-sm group-hover:shadow-md group-hover:border-saffron/40 group-focus-within:ring-2 group-focus-within:ring-saffron">
                    <span className="inline-block mb-4 px-2.5 py-1 rounded-md bg-saffron/20 text-saffron-dark dark:text-saffron font-mono text-xs font-bold tracking-wide">
                      {d.badge}
                    </span>
                    <h2 className="font-display font-bold text-lg text-charcoal dark:text-cream mb-2 group-hover:text-sage dark:group-hover:text-saffron transition-colors duration-200">
                      {d.title}
                    </h2>
                    <p className="text-sm text-warm-gray dark:text-warm-gray-light leading-relaxed">
                      {d.description}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </>
  );
}
