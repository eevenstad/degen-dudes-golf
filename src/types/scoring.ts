// Scoring types — will be expanded in Phase 2

export interface HoleScore {
  hole: number
  strokes: number
  putts?: number
}

export interface RoundScore {
  playerId: string
  courseId: string
  date: string
  holes: HoleScore[]
  totalStrokes: number
}

export interface PlayerHandicap {
  playerId: string
  handicapIndex: number
  lastUpdated: string
}
