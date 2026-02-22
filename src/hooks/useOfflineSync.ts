'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface QueuedScore {
  player_id: string
  course_id: string
  hole_number: number
  gross_score: number
  day_number: number
  timestamp: number
}

const QUEUE_KEY = 'degen-offline-queue'

function readQueue(): QueuedScore[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as QueuedScore[]
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedScore[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    console.error('[offline] Failed to write queue to localStorage')
  }
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [queueLength, setQueueLength] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const syncingRef = useRef(false)

  // Sync queue to localStorage state
  const refreshQueueLength = useCallback(() => {
    setQueueLength(readQueue().length)
  }, [])

  // Enqueue a score for later sync (called when offline)
  const enqueueScore = useCallback((score: QueuedScore) => {
    const queue = readQueue()
    // Remove any existing entry for same player/course/hole (last-write-wins)
    const filtered = queue.filter(
      q =>
        !(
          q.player_id === score.player_id &&
          q.course_id === score.course_id &&
          q.hole_number === score.hole_number
        )
    )
    filtered.push(score)
    writeQueue(filtered)
    setQueueLength(filtered.length)
  }, [])

  // Flush queue to Supabase via direct client (used on reconnect)
  const flushQueue = useCallback(async () => {
    if (syncingRef.current) return
    const queue = readQueue()
    if (queue.length === 0) return

    syncingRef.current = true
    setSyncing(true)
    setNeedsRefresh(false)

    const supabase = createClient()
    const remaining: QueuedScore[] = []

    for (const entry of queue) {
      try {
        // Check if score exists already (conflict handling: last-write-wins by timestamp)
        const { data: existing } = await supabase
          .from('scores')
          .select('id, gross_score')
          .eq('player_id', entry.player_id)
          .eq('course_id', entry.course_id)
          .eq('hole_number', entry.hole_number)
          .single()

        if (existing) {
          // Log conflict to console
          if (existing.gross_score !== entry.gross_score) {
            console.log(
              `[offline] Conflict on player=${entry.player_id} hole=${entry.hole_number}: ` +
              `DB=${existing.gross_score}, queue=${entry.gross_score} — using queue value (last-write-wins)`
            )
          }
          // Update existing (last-write-wins)
          const { error } = await supabase
            .from('scores')
            .update({ gross_score: entry.gross_score })
            .eq('id', existing.id)

          if (error) {
            console.error('[offline] Failed to update score during sync:', error.message)
            remaining.push(entry)
          }
        } else {
          // Insert new score (minimal — server action will recalculate net scores)
          const { error } = await supabase
            .from('scores')
            .insert({
              player_id: entry.player_id,
              course_id: entry.course_id,
              hole_number: entry.hole_number,
              gross_score: entry.gross_score,
            })

          if (error) {
            console.error('[offline] Failed to insert score during sync:', error.message)
            remaining.push(entry)
          }
        }
      } catch (err) {
        console.error('[offline] Unexpected error syncing entry:', err)
        remaining.push(entry)
      }
    }

    writeQueue(remaining)
    setQueueLength(remaining.length)
    syncingRef.current = false
    setSyncing(false)

    if (remaining.length > 0) {
      // Some items failed — prompt user to refresh and retry via server action
      console.warn('[offline] Some scores failed to sync. Prompting refresh.')
      setNeedsRefresh(true)
    }
  }, [])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setNeedsRefresh(false)
      flushQueue()
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    // Set initial state (SSR-safe)
    setIsOnline(navigator.onLine)
    refreshQueueLength()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushQueue, refreshQueueLength])

  return {
    isOnline,
    queueLength,
    syncing,
    needsRefresh,
    enqueueScore,
    flushQueue,
    refreshQueueLength,
  }
}
