"use client"

import React from "react"
import StatsCard from "./StatsCard"
import { ChatBox } from "./ChatBox"

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export default function DashboardLayout({ hideHeader = false }: { hideHeader?: boolean }) {
  return (
    <div className="h-full w-full grid lg:grid-cols-[240px_1fr] gap-0">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col bg-slate-950/70 border-r border-slate-800/80">
        <div className="px-5 py-4 text-xs uppercase tracking-wider text-white/40">Navigation</div>
        <nav className="flex-1 px-2 space-y-1">
          {[
            { label: "Overview" },
            { label: "Connections" },
            { label: "Analytics" },
            { label: "Settings" }
          ].map((item) => (
            <button key={item.label} className="w-full text-left px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/5">
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4">
          <button className="w-full bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium py-2 rounded-lg">
            New Report
          </button>
        </div>
      </aside>

      {/* Main content */}
      <section className="relative h-full overflow-y-auto">
        {/* Optional sticky header (hidden when Navbar already provides one) */}
        {!hideHeader && (
          <div className="sticky top-0 z-10 backdrop-blur bg-slate-950/40 border-b border-slate-800/80">
            <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-white">Dashboard</h1>
                <p className="text-sm text-white/50">Real-time globe activity & insights</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-2 text-sm rounded-lg bg-white/5 text-white/80 hover:text-white border border-white/10">Last 24h</button>
                <button className="px-3 py-2 text-sm rounded-lg bg-white/5 text-white/80 hover:text-white border border-white/10">Last 7d</button>
                <button className="px-3 py-2 text-sm rounded-lg bg-white/5 text-white/80 hover:text-white border border-white/10">Last 30d</button>
              </div>
            </div>
          </div>
        )}

        <div className={`mx-auto max-w-7xl px-6 ${hideHeader ? 'pt-24' : 'py-6'} space-y-6`}>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard title="Active Connections" value="1,248" delta="+4.2%" />
            <StatsCard title="Throughput" value="12.4k" delta="+1.1%" />
            <StatsCard title="Avg. Latency" value="72ms" delta="-3.5%" />
            <StatsCard title="Error Rate" value="0.14%" delta="-0.02%" />
          </div>

          {/* Charts + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel title="Traffic over time" className="lg:col-span-2">
              <div className="h-64 w-full rounded-md bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center text-white/40 text-sm">
                Chart placeholder
              </div>
            </Panel>
            <Panel title="Recent activity">
              <ul className="space-y-3 text-sm text-slate-300">
                <li>• New connection from Tokyo — 2m ago</li>
                <li>• Spike in São Paulo — 5m ago</li>
                <li>• Deployment triggered — 12m ago</li>
                <li>• Alert resolved — 18m ago</li>
                <li>• Dataset refreshed — 29m ago</li>
              </ul>
            </Panel>
          </div>

          {/* Geo + Assistant */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel title="Top regions (geo heatmap)" className="lg:col-span-2">
              <div className="h-72 w-full rounded-md bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center text-white/40 text-sm">
                Geo heatmap placeholder
              </div>
            </Panel>
            <Panel title="Assistant">
              <ChatBox />
            </Panel>
          </div>
        </div>
      </section>
    </div>
  )
}
