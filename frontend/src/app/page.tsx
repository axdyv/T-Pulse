import GlobeVisualization from "../components/GlobeVisualization"
import Navbar from "../components/Navbar"
import StatsCard from "../components/StatsCard"
import { ChatBox } from "../components/ChatBox"
import { StarField } from "../components/StarField"

export default function Home() {
  return (
    <main className="min-h-screen bg-[#060617] text-white antialiased">
      <StarField />
      <Navbar />

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Interactive Globe (zoom into USA) */}
          <div className="lg:col-span-8 bg-linear-to-b from-transparent to-black/40 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold">Global Activity</h2>
                <p className="text-slate-400 mt-1">Live connections and hotspots around the world</p>
              </div>
              <div className="text-sm text-slate-300">Updated just now</div>
            </div>

            <div className="relative h-[640px] flex items-center justify-center">
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-full h-full max-w-[1000px] max-h-[1000px]">
                  <GlobeVisualization />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Dashboard widgets */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <StatsCard title="Active Connections" value="1,248" delta="+4.2%" />
              <StatsCard title="Throughput" value="12.4k" delta="+1.1%" />
            </div>

            <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-lg">
              <h3 className="text-white font-semibold">Recent Events</h3>
              <ul className="mt-3 space-y-3 text-slate-300 text-sm">
                <li>• New connection from Tokyo — 2m ago</li>
                <li>• Spike in São Paulo — 5m ago</li>
                <li>• Deployment triggered — 12m ago</li>
              </ul>
            </div>

            {/* Chat Box */}
            <div className="mt-4">
              <ChatBox />
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
