"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import GlobeVisualization from "../components/GlobeVisualization"
import Navbar from "../components/Navbar"
import StatsCard from "../components/StatsCard"
import { ChatBox } from "../components/ChatBox"
import { StarField } from "../components/StarField"

export default function Home() {
  const [view, setView] = useState<'globe' | 'dashboard'>('globe')

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#060617] text-white antialiased">
      {/* Persistent background */}
      <StarField />

      {/* Navbar - always visible */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <Navbar />
      </div>

      {/* Navigation container (use arrow buttons to switch views) */}
      <motion.div className="relative h-full w-full">

        {/* Right arrow: go to dashboard (visible when viewing globe) */}
        {view === 'globe' && (
          <motion.button
            aria-label="Open dashboard"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('dashboard')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full"
          >
            →
          </motion.button>
        )}

        {/* Left arrow: return to globe (visible when viewing dashboard) */}
        {view === 'dashboard' && (
          <motion.button
            aria-label="Return to globe"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('globe')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full"
          >
            ←
          </motion.button>
        )}
        {/* Globe View - Full screen when active */}
        <motion.div
          key="globe-container"
          animate={{
            scale: view === 'globe' ? 1 : 0.35,
            x: view === 'globe' ? '0%' : '-45%',
            y: view === 'globe' ? '0%' : '-35%',
            opacity: view === 'globe' ? 1 : 0.4,
          }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="absolute inset-0"
          style={{
            pointerEvents: view === 'globe' ? 'auto' : 'none',
            transformOrigin: 'center center',
            width: '100vw',
            height: '100vh'
          }}
        >
          <GlobeVisualization active={view === 'globe'} />
        </motion.div>

        {/* Dashboard View - Slides in from right */}
        <AnimatePresence>
          {view === 'dashboard' && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center px-8 md:px-16"
            >
              <div className="max-w-6xl w-full h-full flex items-center">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                  {/* Dashboard widgets */}
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-3xl font-semibold mb-2">Global Activity</h2>
                      <p className="text-slate-400">Live connections and hotspots around the world</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <StatsCard title="Active Connections" value="1,248" delta="+4.2%" />
                      <StatsCard title="Throughput" value="12.4k" delta="+1.1%" />
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700 p-6 rounded-lg">
                      <h3 className="text-white font-semibold text-lg mb-4">Recent Events</h3>
                      <ul className="space-y-3 text-slate-300 text-sm">
                        <li>• New connection from Tokyo — 2m ago</li>
                        <li>• Spike in São Paulo — 5m ago</li>
                        <li>• Deployment triggered — 12m ago</li>
                      </ul>
                    </div>
                  </div>

                  {/* Chat Box */}
                  <div className="flex items-center">
                    <ChatBox />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation hints */}
        {view === 'globe' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-8 right-8 flex items-center gap-2 text-white/60 text-sm"
          >
            <span>Use the left arrow to open dashboard</span>
          </motion.div>
        )}

        {view === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-8 left-8 flex items-center gap-2 text-white/60 text-sm"
          >
            <span>Use the right arrow to return to globe</span>
          </motion.div>
        )}
      </motion.div>
    </main>
  )
}
