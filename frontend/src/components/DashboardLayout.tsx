"use client"

import React, { useEffect, useState, useRef } from "react"
import { ChatBox } from "./ChatBox"
import SatisfactionMeter from "./SatisfactionMeter"

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
  // Real-time satisfaction score from backend
  const [satisfactionScore, setSatisfactionScore] = useState(0)
  const sentimentSumRef = useRef(0)
  const countRef = useRef(0)
  
  // Live comments feed
  const [liveComments, setLiveComments] = useState<Array<{text: string, sentiment: number, timestamp: number}>>([])
  const commentsContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new comments arrive (only scroll the container, not the page)
  useEffect(() => {
    if (commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight
    }
  }, [liveComments])

  // Connect to WebSocket and calculate average satisfaction
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_API_WS_URL || 'ws://localhost:8000/ws/feed'
    let ws: WebSocket | null = null

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        
        ws.onopen = () => {
          console.log('[DashboardLayout] WebSocket connected')
        }

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            console.log('[DashboardLayout] Received message:', msg)
            console.log('[DashboardLayout] Message type:', msg?.type)
            console.log('[DashboardLayout] Data is array?', Array.isArray(msg?.data))
            console.log('[DashboardLayout] Data length:', msg?.data?.length)
            
            if (msg?.type === 'tweets' && Array.isArray(msg.data)) {
              console.log('[DashboardLayout] Processing tweets:', msg.data.length)
              if (msg.data.length > 0) {
                console.log('[DashboardLayout] First tweet:', JSON.stringify(msg.data[0], null, 2))
              }
              
              // Calculate running average of sentiment scores
              for (const tweet of msg.data) {
                console.log('[DashboardLayout] Tweet sentiment_score:', tweet.sentiment_score, 'text:', tweet.text?.substring(0, 50))
                
                if (typeof tweet.sentiment_score === 'number') {
                  sentimentSumRef.current += tweet.sentiment_score
                  countRef.current++
                  
                  // Add to live comments feed
                  if (tweet.text) {
                    setLiveComments(prev => {
                      const newComments = [...prev, {
                        text: tweet.text,
                        sentiment: tweet.sentiment_score,
                        timestamp: Date.now()
                      }]
                      // Keep only last 50 comments
                      return newComments.slice(-50)
                    })
                  } else {
                    console.log('[DashboardLayout] Tweet missing text field')
                  }
                } else {
                  console.log('[DashboardLayout] Tweet missing sentiment_score')
                }
              }
              
              if (countRef.current > 0) {
                const avgSentiment = sentimentSumRef.current / countRef.current
                console.log(`[DashboardLayout] Setting satisfaction score to: ${avgSentiment.toFixed(3)}`)
                setSatisfactionScore(avgSentiment)
                console.log(`[DashboardLayout] Avg sentiment: ${avgSentiment.toFixed(3)} from ${countRef.current} tweets`)
              }
            } else {
              console.log('[DashboardLayout] Message not matching expected format')
            }
          } catch (err) {
            console.error('[DashboardLayout] Parse error:', err)
          }
        }

        ws.onerror = (err) => {
          console.error('[DashboardLayout] WS error:', err)
          console.error('[DashboardLayout] WS readyState:', ws?.readyState)
          console.error('[DashboardLayout] WS URL:', wsUrl)
        }
        ws.onclose = (event) => {
          console.log('[DashboardLayout] WS closed')
          console.log('[DashboardLayout] Close code:', event.code)
          console.log('[DashboardLayout] Close reason:', event.reason)
          console.log('[DashboardLayout] Reconnecting in 3s...')
          setTimeout(connect, 3000)
        }
      } catch (err) {
        console.error('[DashboardLayout] Connection failed:', err)
      }
    }

    connect()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  return (
    <div className="h-full w-full grid lg:grid-cols-[0px_1fr] gap-0 py-4">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col bg-slate-950/70">
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
          {/* Satisfaction Meter + Live Chat */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <SatisfactionMeter score={satisfactionScore} isLive={true} />
            </div>
            
            {/* Live Chat Feed */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/90">Live Comments</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-xs text-white/60 uppercase tracking-wider">Live</span>
                </div>
              </div>
              
              {/* Scrollable chat container */}
              <div 
                ref={commentsContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[400px]"
              >
                {liveComments.length === 0 ? (
                  <div className="text-center text-white/40 text-sm py-8">
                    Waiting for live comments...
                  </div>
                ) : (
                  liveComments.map((comment, idx) => {
                    // Color based on sentiment
                    const sentimentColor = comment.sentiment < -0.3 
                      ? 'text-pink-400' 
                      : comment.sentiment > 0.3 
                      ? 'text-green-400' 
                      : 'text-gray-400'
                    
                    return (
                      <div 
                        key={idx} 
                        className="animate-in slide-in-from-bottom-2 duration-300"
                      >
                        <div className="flex items-start gap-2 text-sm">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                            comment.sentiment < -0.3 
                              ? 'bg-pink-500' 
                              : comment.sentiment > 0.3 
                              ? 'bg-green-500' 
                              : 'bg-gray-500'
                          }`}></div>
                          <div className="flex-1 min-w-0">
                            <p className={`${sentimentColor} break-words`}>
                              {comment.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
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
