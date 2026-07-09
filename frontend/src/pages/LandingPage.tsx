import { Link } from 'react-router-dom'
import { BarChart2, Upload, Brain, Share2, MessageCircle, Zap } from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <BarChart2 size={14} className="text-white" />
          </div>
          <span className="font-semibold text-white">DashAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link to="/signup" className="btn-primary text-sm">
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center gap-2 bg-violet-600/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-400 mb-6">
          <Zap size={14} />
          AI-powered dashboard builder
        </div>

        <h1 className="text-5xl font-bold text-white leading-tight max-w-3xl mb-6">
          Turn any data into a{' '}
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            beautiful dashboard
          </span>{' '}
          in seconds
        </h1>

        <p className="text-xl text-slate-400 max-w-xl mb-10">
          Upload a CSV, Excel, JSON, or connect your database. Claude AI generates charts,
          insights, and lets you ask questions — all in one shareable dashboard.
        </p>

        <div className="flex items-center gap-4">
          <Link to="/signup" className="btn-primary px-6 py-3 text-base">
            Start for free
          </Link>
          <Link to="/login" className="btn-ghost px-6 py-3 text-base">
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border px-6 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Upload,
              title: 'Upload anything',
              desc: 'CSV, Excel, JSON, Parquet, SQLite, or connect live PostgreSQL/MySQL databases.',
            },
            {
              icon: Brain,
              title: 'AI builds your dashboard',
              desc: 'Claude analyzes your data and picks the best chart types, aggregations, and layout automatically.',
            },
            {
              icon: MessageCircle,
              title: 'Chat with your data',
              desc: 'Ask questions in plain English. "What drove the spike in March?" — Claude answers with insight.',
            },
            {
              icon: Share2,
              title: 'Publish & share',
              desc: 'One click makes your dashboard public. Share the link with your team or the world.',
            },
            {
              icon: BarChart2,
              title: '6 chart types',
              desc: 'Bar, line, area, pie, scatter, and table — automatically picked for your data shape.',
            },
            {
              icon: Zap,
              title: 'Free to start',
              desc: 'Hosted on Vercel + Render free tiers. Bring your own Anthropic API key.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-5">
              <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center mb-3">
                <Icon size={20} className="text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-slate-500">
        DashAI — Built with Claude AI, FastAPI, React, and Supabase
      </footer>
    </div>
  )
}
