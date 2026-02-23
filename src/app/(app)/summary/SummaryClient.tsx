'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DaySummary } from '@/app/actions/data'

interface Course {
  id: string
  name: string
  day_number: number
}

interface Props {
  courses: Course[]
  daysWithData: number[]
  selectedDay: number
  summary: DaySummary | null
}

function formatRelative(relative: number): string {
  if (relative === 0) return 'E'
  return relative > 0 ? `+${relative}` : `${relative}`
}

function relColor(relative: number): string {
  if (relative < 0) return '#DC2626'
  if (relative === 0) return '#F5E6C3'
  return '#9A9A50'
}

function formatMatchFormat(format: string): string {
  const labels: Record<string, string> = {
    best_ball_validation: 'Best Ball + Validation',
    best_ball: 'Best Ball',
    low_total: 'Low Ball + Total',
    singles_match: 'Singles Match Play',
    singles_stroke: 'Singles Stroke Play',
  }
  return labels[format] || format.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatPoints(pts: number): string {
  return pts % 1 === 0 ? String(pts) : pts.toFixed(1)
}

const rankMedals = ['🥇', '🥈', '🥉']

export default function SummaryClient({ courses, daysWithData, selectedDay, summary }: Props) {
  const router = useRouter()

  const handleDaySelect = (day: number) => {
    router.push(`/summary?day=${day}`)
  }

  const todayDate = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen pb-safe" style={{ background: '#1A1A0A' }}>
      {/* Back nav */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: '#9A9A50' }}
        >
          ← Home
        </Link>
        <span style={{ color: '#2D4A1E' }}>|</span>
        <span className="text-sm font-bold" style={{ color: '#D4A947' }}>Day Summary</span>
      </div>

      {/* Day selector */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          {[1, 2, 3].map(day => {
            const course = courses.find(c => c.day_number === day)
            const hasData = daysWithData.includes(day)
            const isSelected = selectedDay === day
            return (
              <button
                key={day}
                onClick={() => handleDaySelect(day)}
                disabled={!hasData}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all border"
                style={
                  isSelected && hasData
                    ? { background: '#D4A947', color: '#1A1A0A', borderColor: '#D4A947' }
                    : hasData
                      ? { background: '#1A3A2A', color: '#9A9A50', borderColor: '#2D4A1E' }
                      : { background: '#1A1A0A', color: '#2D4A1E', borderColor: '#1F2F1A', cursor: 'not-allowed', opacity: 0.5 }
                }
              >
                <div>Day {day}</div>
                {course && (
                  <div className="text-xs font-normal mt-0.5 opacity-75 truncate px-1">
                    {course.name}
                  </div>
                )}
                {!hasData && <div className="text-xs font-normal mt-0.5 opacity-60">No data</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Empty state */}
      {!summary || !summary.hasData ? (
        <div className="px-4 py-12 text-center space-y-4">
          <div className="text-5xl">⛳</div>
          <div className="font-bold text-lg" style={{ color: '#9A9A50' }}>No Data Yet</div>
          <div className="text-sm" style={{ color: '#5C5C2E' }}>
            Day {selectedDay} scores haven&apos;t been entered yet.
            Check back after the round!
          </div>
          <Link
            href="/scores"
            className="inline-block mt-4 px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: '#D4A947', color: '#1A1A0A' }}
          >
            Enter Scores
          </Link>
        </div>
      ) : (
        <div className="px-4 pb-6 space-y-4">
          {/* ═══════════════════════════════════════════
              SCREENSHOT CARD — starts here
          ═══════════════════════════════════════════ */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#1A1A0A',
              boxShadow: '0 0 0 1px #2D4A1E, 0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            {/* Card Header / Branding */}
            <div
              className="px-5 pt-5 pb-4 text-center"
              style={{ background: 'linear-gradient(180deg, #1A3A2A 0%, #1A1A0A 100%)' }}
            >
              <div className="flex justify-center mb-3">
                <Image
                  src="/assets/logo.png"
                  alt="The Desert Duel"
                  width={72}
                  height={72}
                  className="rounded-xl shadow-lg shadow-black/50"
                />
              </div>
              <div className="text-xl font-black tracking-wide" style={{ color: '#D4A947' }}>
                THE DESERT DUEL
              </div>
              <div className="text-xs font-bold tracking-widest mt-0.5 uppercase" style={{ color: '#9A9A50' }}>
                Palm Springs 2026
              </div>
              <div
                className="mt-3 inline-block px-4 py-1.5 rounded-full text-sm font-bold tracking-wide"
                style={{ background: '#2D4A1E', color: '#D4A947' }}
              >
                DAY {summary.dayNumber} RESULTS — {summary.courseName.toUpperCase()}
              </div>
              <div className="text-xs mt-1.5" style={{ color: '#5C5C2E' }}>{todayDate}</div>
            </div>

            {/* ── Team Score ── */}
            <div className="mx-4 mb-1 rounded-xl overflow-hidden border" style={{ borderColor: '#D4A947' }}>
              <div
                className="text-center py-1.5 text-xs font-bold tracking-widest"
                style={{ background: '#8B1A1A', color: '#F5E6C3' }}
              >
                DAY {summary.dayNumber} MATCH POINTS
              </div>
              <div className="grid grid-cols-3" style={{ background: '#1A1A0A' }}>
                <div className="py-5 px-3 text-center" style={{ background: 'rgba(92,92,46,0.25)' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: '#9A9A50' }}>{summary.teamALabel}</div>
                  <div className="text-5xl font-black" style={{ color: '#9A9A50' }}>
                    {formatPoints(summary.dayTeamAPoints)}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span className="text-xl font-bold" style={{ color: '#D4A947' }}>vs</span>
                </div>
                <div className="py-5 px-3 text-center" style={{ background: 'rgba(193,122,42,0.25)' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: '#E09030' }}>{summary.teamBLabel}</div>
                  <div className="text-5xl font-black" style={{ color: '#E09030' }}>
                    {formatPoints(summary.dayTeamBPoints)}
                  </div>
                </div>
              </div>
            </div>

            {/* Cumulative score */}
            <div className="mx-4 mb-4">
              <div
                className="rounded-xl px-4 py-2.5 flex items-center justify-between"
                style={{ background: 'rgba(26,58,42,0.4)', border: '1px solid #2D4A1E' }}
              >
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#9A9A50' }}>
                  Overall Series
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-black text-lg" style={{ color: '#9A9A50' }}>
                    {summary.teamALabel} {formatPoints(summary.cumulativeTeamAPoints)}
                  </span>
                  <span style={{ color: '#2D4A1E' }}>–</span>
                  <span className="font-black text-lg" style={{ color: '#E09030' }}>
                    {formatPoints(summary.cumulativeTeamBPoints)} {summary.teamBLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Match Results ── */}
            {summary.matches.length > 0 && (
              <div className="mx-4 mb-4 space-y-2">
                <div className="text-xs font-bold tracking-widest uppercase px-1" style={{ color: '#D4A947' }}>
                  ⚔️ Match Results
                </div>
                {summary.matches.map((match, idx) => {
                  const aWon = match.teamAPoints > match.teamBPoints
                  const bWon = match.teamBPoints > match.teamAPoints
                  const tied = match.teamAPoints === match.teamBPoints && match.teamAPoints > 0
                  const pending = match.teamAPoints === 0 && match.teamBPoints === 0

                  return (
                    <div
                      key={match.id}
                      className="rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${match.isIsland ? '#D4A947' : '#2D4A1E'}` }}
                    >
                      {/* Match header */}
                      <div
                        className="px-3 py-1.5 flex items-center justify-between"
                        style={{ background: match.isIsland ? 'rgba(212,169,71,0.15)' : '#1A3A2A' }}
                      >
                        <span className="text-xs font-medium" style={{ color: '#9A9A50' }}>
                          {formatMatchFormat(match.format)}
                        </span>
                        <div className="flex items-center gap-2">
                          {match.isIsland && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-bold"
                              style={{ background: '#D4A947', color: '#1A1A0A' }}
                            >
                              ISLAND
                            </span>
                          )}
                          <span className="text-xs" style={{ color: '#5C5C2E' }}>
                            Worth {match.pointValue} pt{match.pointValue !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Match body */}
                      <div className="px-3 py-2.5 grid grid-cols-[1fr_auto_1fr] gap-2 items-center" style={{ background: '#1A1A0A' }}>
                        {/* Team A */}
                        <div className={`${aWon ? 'opacity-100' : 'opacity-70'}`}>
                          <div className="font-bold text-sm" style={{ color: aWon ? '#9A9A50' : '#5C5C2E' }}>
                            {match.teamAPlayers.join(' & ')}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#5C5C2E' }}>{summary.teamALabel}</div>
                        </div>

                        {/* Score */}
                        <div className="text-center px-2">
                          {pending ? (
                            <div className="text-xs" style={{ color: '#2D4A1E' }}>TBD</div>
                          ) : tied ? (
                            <div>
                              <div className="font-black text-xl" style={{ color: '#D4A947' }}>
                                {formatPoints(match.teamAPoints)}–{formatPoints(match.teamBPoints)}
                              </div>
                              <div className="text-xs" style={{ color: '#D4A947' }}>TIED</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-black text-xl text-white">
                                <span style={{ color: aWon ? '#9A9A50' : '#5C5C2E' }}>{formatPoints(match.teamAPoints)}</span>
                                <span style={{ color: '#5C5C2E' }}>–</span>
                                <span style={{ color: bWon ? '#E09030' : '#5C5C2E' }}>{formatPoints(match.teamBPoints)}</span>
                              </div>
                              <div className="text-xs font-bold" style={{ color: aWon ? '#9A9A50' : '#E09030' }}>
                                {aWon ? summary.teamALabel : summary.teamBLabel} WINS
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Team B */}
                        <div className={`text-right ${bWon ? 'opacity-100' : 'opacity-70'}`}>
                          <div className="font-bold text-sm" style={{ color: bWon ? '#E09030' : '#5C5C2E' }}>
                            {match.teamBPlayers.join(' & ')}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#5C5C2E' }}>{summary.teamBLabel}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Individual Leaderboard Top 3 ── */}
            {summary.top3.length > 0 && (
              <div className="mx-4 mb-4 space-y-2">
                <div className="text-xs font-bold tracking-widest uppercase px-1" style={{ color: '#D4A947' }}>
                  🏆 Individual Standings (All Days)
                </div>
                {summary.top3.map((player, idx) => (
                  <div
                    key={player.name}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      background: idx === 0
                        ? 'linear-gradient(135deg, rgba(212,169,71,0.2) 0%, rgba(26,58,42,0.4) 100%)'
                        : 'rgba(26,58,42,0.3)',
                      border: `1px solid ${idx === 0 ? '#D4A947' : '#2D4A1E'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{rankMedals[idx]}</span>
                      <div>
                        <div className="font-bold text-white text-sm">{player.name}</div>
                        <div className="text-xs" style={{ color: player.team === 'USA' ? '#9A9A50' : '#E09030' }}>
                          {player.team || 'No team'} · {player.holesPlayed} holes
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-black text-xl"
                        style={{ color: relColor(player.relative) }}
                      >
                        {formatRelative(player.relative)}
                      </div>
                      <div className="text-xs" style={{ color: '#5C5C2E' }}>net vs par</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Highlights Row ── */}
            <div className="mx-4 mb-4 grid grid-cols-2 gap-3">
              {/* Best Round */}
              {summary.bestRound && (
                <div
                  className="rounded-xl px-3 py-3"
                  style={{ background: 'rgba(26,58,42,0.4)', border: '1px solid #2D4A1E' }}
                >
                  <div className="text-xs font-bold tracking-widest mb-2" style={{ color: '#D4A947' }}>
                    🔥 BEST ROUND
                  </div>
                  <div className="font-bold text-white text-sm truncate">
                    {summary.bestRound.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: summary.bestRound.team === 'USA' ? '#9A9A50' : '#E09030' }}>
                    {summary.bestRound.team}
                  </div>
                  <div
                    className="text-2xl font-black mt-1"
                    style={{ color: relColor(summary.bestRound.relative) }}
                  >
                    {formatRelative(summary.bestRound.relative)}
                  </div>
                  <div className="text-xs" style={{ color: '#5C5C2E' }}>
                    ({summary.bestRound.holesPlayed} holes)
                  </div>
                </div>
              )}

              {/* Biggest Mover */}
              {summary.biggestMover && (
                <div
                  className="rounded-xl px-3 py-3"
                  style={{ background: 'rgba(26,58,42,0.4)', border: '1px solid #2D4A1E' }}
                >
                  <div className="text-xs font-bold tracking-widest mb-2" style={{ color: '#D4A947' }}>
                    📈 BIGGEST MOVER
                  </div>
                  <div className="font-bold text-white text-sm truncate">
                    {summary.biggestMover.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: summary.biggestMover.team === 'USA' ? '#9A9A50' : '#E09030' }}>
                    {summary.biggestMover.team}
                  </div>
                  <div
                    className="text-2xl font-black mt-1"
                    style={{ color: relColor(summary.biggestMover.dayRelative) }}
                  >
                    {formatRelative(summary.biggestMover.dayRelative)}
                  </div>
                  <div className="text-xs" style={{ color: '#5C5C2E' }}>
                    today
                    {summary.biggestMover.improvement !== 0 && (
                      <span style={{ color: '#DC2626' }}>
                        {' '}{summary.biggestMover.improvement < 0
                          ? `${summary.biggestMover.improvement.toFixed(1)}/hole`
                          : `+${summary.biggestMover.improvement.toFixed(1)}/hole`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Screenshot prompt */}
            <div
              className="mx-4 mb-4 rounded-xl py-2.5 px-4 text-center"
              style={{ background: 'rgba(212,169,71,0.1)', border: '1px solid rgba(212,169,71,0.3)' }}
            >
              <span className="text-xs font-bold tracking-wide" style={{ color: '#D4A947' }}>
                📸 Screenshot &amp; share to the group chat
              </span>
            </div>

            {/* Card footer */}
            <div
              className="px-5 py-3 text-center text-xs"
              style={{ background: '#1A3A2A', color: '#5C5C2E' }}
            >
              thedegendudes.com · The Desert Duel 2026
            </div>
          </div>
          {/* ═══════════════════════════════════════════
              SCREENSHOT CARD — ends here
          ═══════════════════════════════════════════ */}
        </div>
      )}
    </div>
  )
}
