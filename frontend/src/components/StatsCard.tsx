import React from "react"

export function StatsCard({ title, value, delta }: { title: string; value: string; delta?: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-lg">
      <div className="text-slate-300 text-sm">{title}</div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="text-white text-2xl font-semibold">{value}</div>
        {delta && <div className="text-sm text-green-400">{delta}</div>}
      </div>
    </div>
  )
}

export default StatsCard
