"use client"

import React from "react"

export function Navbar() {
  return (
    <header className="w-full bg-transparent py-4">
      <nav className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">TP</div>
          <div className="hidden sm:block">
            <h1 className="text-white text-lg font-semibold">T-Pulse Dashboard</h1>
            <p className="text-slate-400 text-xs">Real-time globe activity & insights</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ul className="hidden md:flex items-center gap-6 text-slate-300">
            <li className="hover:text-white cursor-pointer">Overview</li>
            <li className="hover:text-white cursor-pointer">Connections</li>
            <li className="hover:text-white cursor-pointer">Analytics</li>
            <li className="hover:text-white cursor-pointer">Settings</li>
          </ul>

          <button className="hidden sm:inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md text-sm">
            New Report
          </button>

          <div className="w-9 h-9 rounded-full bg-slate-700 ring-1 ring-slate-600"></div>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
