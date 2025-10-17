export interface Activity {
  id: string
  user_id: string
  activity_name: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  created_at: string
  updated_at: string
}

export interface ActivityStats {
  activity_name: string
  total_minutes: number
  session_count: number
}
