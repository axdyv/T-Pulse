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
	const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

	useEffect(() => {
		if (!visible) return
		const svgEl = svgRef.current
		if (!svgEl) return
		const svg = d3.select(svgEl)
		const width = svgEl.clientWidth || 800
		const height = svgEl.clientHeight || 500

		svg.selectAll("*").remove()

			const projection = geoAlbersUsa().translate([width / 2, height / 2]).scale(Math.min(width, height) * 1.25)
				const path = geoPath(projection)

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
							.scaleExtent([0.5, 1])
							.on("zoom", (event) => {
								g.attr("transform", event.transform.toString())

								// Exit to globe if zoomed out below threshold
								if (event.transform.k < 0.8 && onExit) {
									onExit()
								}
							})

						zoomBehaviorRef.current = zoom
						svg.call(zoom as unknown as d3.ZoomBehavior<SVGSVGElement, unknown>)

						// Reset zoom to identity (centered and scale 1) whenever map becomes visible
						svg.call(zoom.transform as any, d3.zoomIdentity)
					} catch (e) {
						console.error("Failed loading US topology", e)
					}
				})()
	}, [visible, onExit])

	return (
		<div className={`absolute inset-0 transition-opacity duration-500 ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
			{/* Header overlay so the SVG can occupy the full viewport */}
			<div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2">
				<h3 className="text-sm font-semibold text-white">United States Map (Prototype)</h3>
				<button
					onClick={onExit}
					className="text-xs text-white/70 hover:text-white border border-white/30 rounded px-2 py-1"
				>Back to Globe</button>
			</div>

			{/* Full-viewport SVG map */}
			<svg ref={svgRef} className="w-full h-screen block" />

			<p className="absolute bottom-4 left-4 text-xs text-white/50">Heat map layer will be added later.</p>
		</div>
	)
}
