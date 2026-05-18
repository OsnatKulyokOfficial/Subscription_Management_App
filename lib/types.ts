export type Role = 'trainee' | 'coach'

export interface User {
  id: string
  phone: string
  name: string | null
  role: Role
  created_at: string
  is_active?: boolean
}

export interface Group {
  id: string
  name: string
  color: string
  max_capacity: number
  created_at: string
}

export interface Session {
  id: string
  group_id: string
  day_of_week: number | null   // 0=Sun..6=Sat, null for one-time
  session_time: string         // HH:MM
  is_recurring: boolean
  session_date: string | null  // ISO date for one-time sessions
  is_cancelled: boolean
  notes: string | null
  created_at: string
  group?: Group
}

export interface UserGroup {
  id: string
  user_id: string
  group_id: string
  joined_at: string
  user?: User
  group?: Group
}

export interface Registration {
  id: string
  user_id: string
  session_id: string
  occurrence_date: string
  registered_at: string
  attended: boolean | null
}

export interface GroupTransfer {
  id: string
  user_id: string
  from_group_id: string
  to_group_id: string
  transferred_at: string
}

export interface NotificationLog {
  id: string
  user_id: string
  message: string
  type: string
  sent_at: string
}

export const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
