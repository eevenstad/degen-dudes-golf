import { getScoreHistory } from '@/app/actions/scores'
import Link from 'next/link'

export default async function ScoreHistoryPage() {
  const history = await getScoreHistory(100)

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const scoreDiff = (prev: number, next: number) => {
    const diff = next - prev
    if (diff === 0) return null
    return diff > 0 ? `+${diff}` : `${diff}`
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#D4A947]">Score History</h2>
        <Link href="/scores" className="text-sm text-[#9A9A50] hover:text-[#D4A947]">
          ← Back
        </Link>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-[#9A9A50]">
          No score changes recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => {
            const diff = scoreDiff(entry.previous_gross, entry.new_gross)
            const isUndo = entry.changed_by === 'undo'
            return (
              <div
                key={entry.id}
                className="rounded-xl bg-[#1A3A2A] border border-[#2D4A1E] p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#F5E6C3]">
                        {entry.scores?.players?.name ?? 'Unknown'}
                      </span>
                      {isUndo && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-400 border border-orange-800/40">
                          UNDO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#9A9A50] mt-0.5">
                      {entry.scores?.courses?.name
                        ? `Day ${entry.scores.courses.day_number} • ${entry.scores.courses.name}`
                        : ''}{' '}
                      Hole {entry.scores?.hole_number}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#9A9A50] text-sm line-through">
                        {entry.previous_gross}
                      </span>
                      <span className="text-[#9A9A50] text-xs">→</span>
                      <span className="text-[#F5E6C3] font-bold text-sm">
                        {entry.new_gross}
                      </span>
                      {diff && (
                        <span className={`text-xs font-medium ${
                          diff.startsWith('+') ? 'text-orange-400' : 'text-green-400'
                        }`}>
                          ({diff})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#9A9A50] mt-0.5">
                      {formatTime(entry.changed_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
