import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-beige-primary">
      {/* Header */}
      <header className="border-b border-gray-300/30 bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center gap-3">
            <img
              src="/img/igris-logo-34.png"
              alt="Igris Logo"
              className="h-8 w-8"
            />
            <h1 className="text-2xl font-semibold text-foreground">
              Igris Inertial
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Documentation
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose your product to get started with comprehensive guides, API references, and examples.
          </p>
        </div>

        {/* Product Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Overture Card */}
          <Link
            href="/overture"
            className="group block p-8 rounded-xl bg-white border border-gray-300/30 hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-2xl font-semibold text-foreground group-hover:text-primary transition-colors">
                Overture
              </h3>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Cloud LLM gateway with intelligent routing, automatic failover, and cost optimization.
              Route requests across multiple AI providers with Thompson Sampling and semantic routing.
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              <span className="text-xs px-3 py-1 rounded-full bg-card text-foreground border border-gray-300/30">
                Multi-Provider Routing
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-card text-foreground border border-gray-300/30">
                Cost Optimization
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-card text-foreground border border-gray-300/30">
                Auto Failover
              </span>
            </div>
          </Link>

          {/* Runtime Card */}
          <Link
            href="/runtime"
            className="group block p-8 rounded-xl bg-white border border-gray-300/30 hover:border-secondary/50 transition-all duration-200 hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-2xl font-semibold text-foreground group-hover:text-secondary transition-colors">
                Runtime
              </h3>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary group-hover:translate-x-1 transition-all" />
            </div>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Offline-first AI execution with local LLM fallback. Deploy anywhere with automatic cloud-to-local
              failover, reflection agents, and on-device training capabilities.
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              <span className="text-xs px-3 py-1 rounded-full bg-card text-foreground border border-gray-300/30">
                Local Execution
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-card text-foreground border border-gray-300/30">
                AI Agents
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-card text-foreground border border-gray-300/30">
                Edge Deployment
              </span>
            </div>
          </Link>
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Both products share common concepts like observability, multi-tenancy, and OpenAI-compatible APIs.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-300/30 mt-20">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 Igris Inertial. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a
                href="https://github.com/igris-inertial"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                GitHub
              </a>
              <a
                href="mailto:support@igrisinertial.com"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
