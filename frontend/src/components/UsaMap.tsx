"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef } from "react"
import * as d3 from "d3"
import { geoAlbersUsa, geoPath } from "d3-geo"
import { feature } from "topojson-client"

interface UsaMapProps {
	visible: boolean
	onExit?: () => void
}

// Prototype USA map (placeholder geometry). Replace mock rectangles with real TopoJSON later.
export const UsaMap: React.FC<UsaMapProps> = ({ visible, onExit }) => {
	const svgRef = useRef<SVGSVGElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const transformRef = useRef<{k:number,x:number,y:number}>({k:1,x:0,y:0})
	const pointsRef = useRef<Array<{lat:number, lon:number, sentiment:number, ts:number}>>([])
	const wsRef = useRef<WebSocket | null>(null)

	useEffect(() => {
		if (!visible) return
		const svgEl = svgRef.current
		const canvasEl = canvasRef.current
		if (!svgEl || !canvasEl) return
		const svg = d3.select(svgEl)
		const width = svgEl.clientWidth || 800
		const height = svgEl.clientHeight || 500

		svg.selectAll("*").remove()

			const projection = geoAlbersUsa().translate([width / 2, height / 2]).scale(Math.min(width, height) * 1.25)
				const path = geoPath(projection)

				// prepare canvas overlay
				canvasEl.width = width
			canvasEl.height = height
			const ctx = canvasEl.getContext('2d')!
			ctx.clearRect(0,0,width,height)

			const colorForSentiment = (s:number) => {
				// T-Mobile color scheme: darker magenta (dissatisfied) to white (satisfied)
				// -1 (dissatisfied) = darker magenta
				// +1 (satisfied) = white
				const t = Math.max(0, Math.min(1, (s + 1) / 2)) // normalize to 0..1
				
				// Interpolate from darker magenta (180, 0, 90) to white (255, 255, 255)
				const r = Math.round(180 + (255 - 180) * t)
				const g = Math.round(0 + (255 - 0) * t)
				const b = Math.round(90 + (255 - 90) * t)
				return `rgb(${r}, ${g}, ${b})`
			}

			const drawHeatmap = () => {
					ctx.save()
					// apply zoom/pan transform
					const {k,x,y} = transformRef.current
					ctx.setTransform(k, 0, 0, k, x, y)
					// clear in world space: reset transform temporarily
					ctx.restore()
					ctx.clearRect(0,0,canvasEl.width, canvasEl.height)
					ctx.save()
				ctx.setTransform(k, 0, 0, k, x, y)
				// Don't use additive blending to keep circles distinct
				ctx.globalCompositeOperation = 'source-over'
				for (const p of pointsRef.current) {
					const xy = projection([p.lon, p.lat]) as [number, number] | null
					if (!xy) continue
					const [px, py] = xy
					// Size based on sentiment: dissatisfied (-1) = smaller, satisfied (+1) = bigger
					const t = Math.max(0, Math.min(1, (p.sentiment + 1) / 2)) // normalize to 0..1
					const radius = 5 + t * 5  // Range from 5px (dissatisfied) to 10px (satisfied)
				const grad = ctx.createRadialGradient(px, py, 0, px, py, radius)
				const col = colorForSentiment(p.sentiment)
				// Center is full color with opacity
				grad.addColorStop(0, col.replace('rgb', 'rgba').replace(')', ', 0.8)'))
				// Mid fade
				grad.addColorStop(0.5, col.replace('rgb', 'rgba').replace(')', ', 0.4)'))
				// Fade to transparent magenta at edges (not black!)
				grad.addColorStop(1, col.replace('rgb', 'rgba').replace(')', ', 0)'))
				ctx.fillStyle = grad
				ctx.beginPath()
				ctx.arc(px, py, radius, 0, Math.PI * 2)
				ctx.fill()
				}
				ctx.restore()
				}

				// Load topojson asynchronously inside an IIFE
				;(async () => {
					try {
						const mod = await import("us-atlas/states-10m.json")
						const topo: any = (mod as any).default ?? mod
						const states = feature(topo, topo.objects.states) as any
						const features: GeoJSON.Feature[] = states.features

						const g = svg.append("g").attr("class", "states")

						g.selectAll("path.state")
							.data(features)
							.enter()
							.append("path")
							.attr("class", "state")
							.attr("d", (d) => path(d as any) || "")
							.attr("fill", "#2a2a2a")
							.attr("stroke", "#E20074")
							.attr("stroke-width", 1.5)
							.style("cursor", "pointer")
							.on("mouseover", function () { d3.select(this).attr("fill", "#404040") })
							.on("mouseout", function () { d3.select(this).attr("fill", "#2a2a2a") })
							.on("click", (_event, d) => { const f = d as any; console.log("Clicked state", f.id ?? f.properties?.name) })

						const zoom = d3.zoom<SVGSVGElement, unknown>()
							.scaleExtent([1, 8])
							.on("zoom", (event) => { 
								g.attr("transform", event.transform.toString())
										// track transform for canvas overlay
										transformRef.current = {k: event.transform.k, x: event.transform.x, y: event.transform.y}
										drawHeatmap()
									})
						svg.call(zoom as unknown as d3.ZoomBehavior<SVGSVGElement, unknown>)

						// establish websocket for live points
						const WS_URL = process.env.NEXT_PUBLIC_API_WS_URL || 'ws://localhost:8000/ws/feed'
						console.log('[UsaMap] Connecting to WebSocket:', WS_URL)
						try {
							const ws = new WebSocket(WS_URL)
							wsRef.current = ws
							ws.onopen = () => console.log('[UsaMap] WebSocket connected!')
											ws.onmessage = (ev) => {
								try {
									const msg = JSON.parse(ev.data)
									console.log('[UsaMap] Received:', msg.type, 'count:', msg.data?.length || 0)
									if (msg?.type === 'tweets' && Array.isArray(msg.data)) {
										const now = Date.now() / 1000
										let added = 0
										// append valid points and prune >60s
										for (const t of msg.data) {
											const lat = typeof t.lat === 'number' ? t.lat : null
											const lon = typeof t.lon === 'number' ? t.lon : null
											const s = typeof t.sentiment_score === 'number' ? t.sentiment_score : null
											// Always use current time instead of tweet timestamp (which may be old synthetic data)
											if (lat !== null && lon !== null && s !== null) {
												console.log(`[UsaMap] Sentiment: ${s.toFixed(3)}`)
												pointsRef.current.push({lat, lon, sentiment: s, ts: now})
												added++
											}
										}
										// keep 60s rolling
										const cutoff = now - 60
										const before = pointsRef.current.length
										pointsRef.current = pointsRef.current.filter(p => p.ts >= cutoff)
										console.log(`[UsaMap] Added ${added}, pruned ${before - pointsRef.current.length}, total: ${pointsRef.current.length}`)
										drawHeatmap()
														}
													} catch { /* ignore */ }
							}
							ws.onerror = (err) => console.error('[UsaMap] WS error:', err)
							ws.onclose = () => console.log('[UsaMap] WS closed')
						} catch (e) {
							console.error('WS connect failed', e)
						}
					} catch (e) {
						console.error("Failed loading US topology", e)
					}
				})()

		return () => {
			// cleanup ws
			if (wsRef.current) { try { wsRef.current.close() } catch {} wsRef.current = null }
		}
	}, [visible])

	return (
		<div className={`absolute inset-0 transition-opacity duration-500 ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
			<div className="flex items-center justify-end px-4 py-2">
				<button
					onClick={onExit}
					className="text-xs text-white/70 hover:text-white border border-white/30 rounded px-2 py-1"
				>Back to Globe</button>
			</div>
			<div className="relative w-full h-[500px]">
				<svg ref={svgRef} className="absolute inset-0 w-full h-full" />
				<canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
				{/* Legend */}
				<div className="absolute top-2 right-4 flex flex-col items-end gap-1 text-white/80 text-[11px]">
					<div>Sentiment</div>
					<div className="w-40 h-2 rounded-full" style={{
						background: 'linear-gradient(to right, rgb(128, 0, 128), rgb(226, 0, 116))'
					}} />
					<div className="flex justify-between w-40">
						<span>-1 (dissatisfied)</span>
						<span>+1 (satisfied)</span>
					</div>
				</div>
			</div>
		</div>
	)
}
