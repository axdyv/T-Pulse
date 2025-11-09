"use client"

import React from "react"

export function Navbar() {
  return (
    <header className="w-full bg-transparent py-4">
      <nav className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, #b0005f 100%)",
            }}
          >
            TP
          </div>
          <div className="hidden sm:block">
            <h1 className="text-white text-lg font-semibold">T-Pulse Dashboard</h1>
            <p className="text-slate-400 text-xs">Real-time globe activity & insights</p>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
