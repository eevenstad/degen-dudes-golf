export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      settings: {
        Row: { key: string; value: string; updated_at: string }
        Insert: { key: string; value: string; updated_at?: string }
        Update: { key?: string; value?: string; updated_at?: string }
      }
      players: {
        Row: { id: string; name: string; handicap_index: number; team: 'USA' | 'Europe' | null; display_order: number; created_at: string }
        Insert: { id?: string; name: string; handicap_index: number; team?: 'USA' | 'Europe' | null; display_order?: number; created_at?: string }
        Update: { id?: string; name?: string; handicap_index?: number; team?: 'USA' | 'Europe' | null; display_order?: number }
      }
      courses: {
        Row: { id: string; name: string; day_number: number; par_total: number; created_at: string }
        Insert: { id?: string; name: string; day_number: number; par_total?: number }
        Update: { id?: string; name?: string; day_number?: number; par_total?: number }
      }
      tees: {
        Row: { id: string; course_id: string; name: string; rating: number; slope: number; created_at: string }
        Insert: { id?: string; course_id: string; name: string; rating: number; slope: number }
        Update: { id?: string; course_id?: string; name?: string; rating?: number; slope?: number }
      }
      holes: {
        Row: { id: string; course_id: string; hole_number: number; par: number; handicap_rank: number; created_at: string }
        Insert: { id?: string; course_id: string; hole_number: number; par: number; handicap_rank: number }
        Update: { id?: string; course_id?: string; hole_number?: number; par?: number; handicap_rank?: number }
      }
      hole_yardages: {
        Row: { id: string; hole_id: string; tee_id: string; yardage: number | null }
        Insert: { id?: string; hole_id: string; tee_id: string; yardage?: number | null }
        Update: { id?: string; hole_id?: string; tee_id?: string; yardage?: number | null }
      }
      player_tee_assignments: {
        Row: { id: string; player_id: string; course_id: string; tee_id: string; course_handicap: number }
        Insert: { id?: string; player_id: string; course_id: string; tee_id: string; course_handicap: number }
        Update: { id?: string; player_id?: string; course_id?: string; tee_id?: string; course_handicap?: number }
      }
      groups: {
        Row: { id: string; day_number: number; group_number: number; format: GroupFormat; created_at: string }
        Insert: { id?: string; day_number: number; group_number: number; format: GroupFormat }
        Update: { id?: string; day_number?: number; group_number?: number; format?: GroupFormat }
      }
      group_players: {
        Row: { id: string; group_id: string; player_id: string; playing_handicap: number }
        Insert: { id?: string; group_id: string; player_id: string; playing_handicap?: number }
        Update: { id?: string; group_id?: string; player_id?: string; playing_handicap?: number }
      }
      matches: {
        Row: { id: string; group_id: string; match_number: number; format: GroupFormat; team_a_label: string | null; team_b_label: string | null; team_a_points: number; team_b_points: number; status: MatchStatus; created_at: string }
        Insert: { id?: string; group_id: string; match_number: number; format: GroupFormat; team_a_label?: string | null; team_b_label?: string | null; team_a_points?: number; team_b_points?: number; status?: MatchStatus }
        Update: { id?: string; group_id?: string; match_number?: number; format?: GroupFormat; team_a_label?: string | null; team_b_label?: string | null; team_a_points?: number; team_b_points?: number; status?: MatchStatus }
      }
      match_players: {
        Row: { id: string; match_id: string; player_id: string; side: 'a' | 'b' }
        Insert: { id?: string; match_id: string; player_id: string; side: 'a' | 'b' }
        Update: { id?: string; match_id?: string; player_id?: string; side?: 'a' | 'b' }
      }
      scores: {
        Row: { id: string; player_id: string; course_id: string; hole_number: number; gross_score: number; net_score: number | null; ph_score: number | null; ch_strokes: number; ph_strokes: number; entered_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; player_id: string; course_id: string; hole_number: number; gross_score: number; net_score?: number | null; ph_score?: number | null; ch_strokes?: number; ph_strokes?: number; entered_by?: string | null }
        Update: { id?: string; player_id?: string; course_id?: string; hole_number?: number; gross_score?: number; net_score?: number | null; ph_score?: number | null; ch_strokes?: number; ph_strokes?: number; entered_by?: string | null }
      }
      score_history: {
        Row: { id: string; score_id: string; previous_gross: number; new_gross: number; changed_by: string | null; changed_at: string }
        Insert: { id?: string; score_id: string; previous_gross: number; new_gross: number; changed_by?: string | null }
        Update: never
      }
    }
  }
}

export type GroupFormat = 'best_ball_validation' | 'best_ball' | 'low_total' | 'singles_match' | 'singles_stroke'
export type MatchStatus = 'not_started' | 'in_progress' | 'complete'
export type Team = 'USA' | 'Europe'
