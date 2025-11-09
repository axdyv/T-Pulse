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
					// map [-1..1] to [0..1]
					const t = Math.max(0, Math.min(1, (s + 1) / 2))
					const g = Math.round(255 * t)
					return `rgba(255, ${g}, 255, 0.22)` // alpha per point; additive blend will build intensity
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
					ctx.globalCompositeOperation = 'lighter'
					const radius = 28
					for (const p of pointsRef.current) {
						const xy = projection([p.lon, p.lat]) as [number, number] | null
						if (!xy) continue
						const [px, py] = xy
						const grad = ctx.createRadialGradient(px, py, 0, px, py, radius)
						const col = colorForSentiment(p.sentiment)
						grad.addColorStop(0, col)
						grad.addColorStop(1, 'rgba(255,255,255,0)')
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
							.attr("fill", "#1e3a8a")
							.attr("stroke", "#93c5fd")
							.attr("strokeWidth", 0.75)
							.style("cursor", "pointer")
							.on("mouseover", function () { d3.select(this).attr("fill", "#2563eb") })
							.on("mouseout", function () { d3.select(this).attr("fill", "#1e3a8a") })
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
						try {
							const ws = new WebSocket(WS_URL)
							wsRef.current = ws
											ws.onmessage = (ev) => {
								try {
									const msg = JSON.parse(ev.data)
									if (msg?.type === 'tweets' && Array.isArray(msg.data)) {
										const now = Date.now() / 1000
										// append valid points and prune >60s
										for (const t of msg.data) {
											const lat = typeof t.lat === 'number' ? t.lat : null
											const lon = typeof t.lon === 'number' ? t.lon : null
											const s = typeof t.sentiment_score === 'number' ? t.sentiment_score : null
											const ts = typeof t.timestamp === 'number' ? t.timestamp : now
											if (lat !== null && lon !== null && s !== null) {
												pointsRef.current.push({lat, lon, sentiment: s, ts})
											}
										}
										// keep 60s rolling
										const cutoff = (Date.now()/1000) - 60
										pointsRef.current = pointsRef.current.filter(p => p.ts >= cutoff)
										drawHeatmap()
														}
													} catch { /* ignore */ }
							}
							ws.onerror = () => { /* ignore for now */ }
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
			<div className="flex items-center justify-between px-4 py-2">
				<h3 className="text-sm font-semibold text-white">United States Map (Prototype)</h3>
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
						background: 'linear-gradient(to right, #ff00ff, #ffffff)'
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
