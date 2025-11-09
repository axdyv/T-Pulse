"use client"

import React, { useEffect, useState } from "react"

interface SatisfactionMeterProps {
  // Score from -1 (dissatisfied) to 1 (satisfied)
  score?: number
  isLive?: boolean
}

export default function SatisfactionMeter({ score = 0, isLive = true }: SatisfactionMeterProps) {
  const [displayScore, setDisplayScore] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Animate score changes
  useEffect(() => {
    setIsAnimating(true)
    const timeout = setTimeout(() => {
      setDisplayScore(score)
      setIsAnimating(false)
    }, 100)
    return () => clearTimeout(timeout)
  }, [score])

  // Convert -1 to 1 scale to 0-100 percentage
  const percentage = ((displayScore + 1) / 2) * 100

  // Determine color based on score
  const getColor = (score: number) => {
    if (score < -0.3) return '#E20074' // T-Mobile magenta for negative
    if (score < 0.3) return '#888888' // Grey for neutral
    return '#00D1A0' // Green for positive
  }

  const getLabel = (score: number) => {
    if (score < -0.5) return 'Very Dissatisfied'
    if (score < -0.2) return 'Dissatisfied'
    if (score < 0.2) return 'Neutral'
    if (score < 0.5) return 'Satisfied'
    return 'Very Satisfied'
  }

  const color = getColor(displayScore)
  const label = getLabel(displayScore)

  return (
    <div className="h-full flex flex-col">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-semibold text-white">Customer Satisfaction</h3>
          <p className="text-sm text-white/50 mt-1">Average sentiment across America</p>
        </div>
        {isLive && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs text-white/60 uppercase tracking-wider">Live</span>
          </div>
        )}
      </div>

      {/* Main score display */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Circular gauge */}
        <div className="relative w-48 h-48 mb-6">
          {/* Background circle */}
          <svg className="transform -rotate-90 w-48 h-48">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="#1a1a1a"
              strokeWidth="12"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke={color}
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - percentage / 100)}`}
              strokeLinecap="round"
              className={`transition-all duration-700 ease-out ${isAnimating ? 'opacity-70' : 'opacity-100'}`}
              style={{
                filter: `drop-shadow(0 0 8px ${color}40)`
              }}
            />
          </svg>

          {/* Score text in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-white mb-1" style={{ color }}>
              {displayScore >= 0 ? '+' : ''}{displayScore.toFixed(2)}
            </div>
            <div className="text-sm text-white/50">Score</div>
          </div>
        </div>

        {/* Status label */}
        <div 
          className="px-6 py-2 rounded-full text-sm font-medium transition-colors duration-300"
          style={{ 
            backgroundColor: `${color}20`,
            color: color,
            border: `1px solid ${color}40`
          }}
        >
          {label}
        </div>

        {/* Scale reference */}
        <div className="mt-8 w-full max-w-md">
          <div className="flex items-center justify-between text-xs text-white/40 mb-2">
            <span>Dissatisfied</span>
            <span>Neutral</span>
            <span>Satisfied</span>
          </div>
          <div className="h-2 rounded-full bg-gradient-to-r from-pink-600 via-gray-500 to-green-500 opacity-30"></div>
        </div>
      </div>

      {/* Stats footer */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
        <div>
          <div className="text-xs text-white/50 mb-1">Min</div>
          <div className="text-lg font-semibold text-white">-1.0</div>
        </div>
        <div>
          <div className="text-xs text-white/50 mb-1">Current</div>
          <div className="text-lg font-semibold" style={{ color }}>
            {displayScore.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/50 mb-1">Max</div>
          <div className="text-lg font-semibold text-white">+1.0</div>
        </div>
      </div>
    </div>
  )
}
