'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Group, User } from '@/lib/types'
import { sendPush } from '@/lib/push'
import { useTraineeHistory } from '@/contexts/TraineeHistoryContext'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'

interface TraineeWithGroup extends User {
  userGroupId: string
  groupId: string
}

function TraineeCard({ trainee, isDragging }: { trainee: TraineeWithGroup; isDragging?: boolean }) {
  const { openHistory } = useTraineeHistory()
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: trainee.id,
    data: { trainee },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-xl px-3 py-2.5 flex items-center gap-2 shadow-sm border border-slate-100
                  active:shadow-md cursor-grab select-none ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600">
        {(trainee.name ?? trainee.phone).slice(0, 1)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {trainee.name ?? 'ללא שם'}
        </p>
        <p className="text-xs text-slate-400 truncate">{trainee.phone}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); openHistory(trainee) }}
        className="text-slate-300 hover:text-primary-500 text-sm px-1 flex-shrink-0"
        title="דוח מתאמן"
      >📋</button>
      <span className="text-slate-300 text-lg">⠿</span>
    </div>
  )
}

function GroupDropZone({
  group,
  trainees,
  activeId,
}: {
  group: Group
  trainees: TraineeWithGroup[]
  activeId: string | null
}) {
  const { isOver, setNodeRef } = useDroppable({ id: group.id })

  return (
    <div
      ref={setNodeRef}
      className={`card transition-all ${isOver ? 'ring-2 ring-primary-400 bg-primary-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
          <h3 className="font-bold text-slate-800">{group.name}</h3>
        </div>
        <span className="text-sm font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {trainees.length} / {group.max_capacity}
        </span>
      </div>

      <div className="space-y-2 min-h-[60px]">
        {trainees.map(t => (
          <TraineeCard key={t.id} trainee={t} isDragging={t.id === activeId} />
        ))}
        {trainees.length === 0 && (
          <div className={`h-12 rounded-xl border-2 border-dashed flex items-center justify-center
                          text-sm text-slate-300 transition-colors
                          ${isOver ? 'border-primary-300 text-primary-400' : 'border-slate-200'}`}>
            {isOver ? 'שחרר כאן' : 'גרור מתאמן לכאן'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [trainees, setTrainees] = useState<TraineeWithGroup[]>([])
  const [unassigned, setUnassigned] = useState<User[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const load = async () => {
    setLoading(true)
    const { data: groupsData } = await supabase.from('groups').select('*').order('created_at')
    const { data: ugData } = await supabase
      .from('user_groups')
      .select('*, user:users(*)')

    const { data: allTrainees } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'trainee')

    const assignedIds = new Set(ugData?.map(ug => ug.user_id) ?? [])
    const traineeList: TraineeWithGroup[] = (ugData ?? [])
      .filter(ug => ug.user)
      .map(ug => ({ ...ug.user, userGroupId: ug.id, groupId: ug.group_id }))

    setGroups(groupsData ?? [])
    setTrainees(traineeList)
    setUnassigned((allTrainees ?? []).filter(t => !assignedIds.has(t.id)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const traineeId = active.id as string
    const targetGroupId = over.id as string
    const trainee = trainees.find(t => t.id === traineeId)
    if (!trainee) return
    if (trainee.groupId === targetGroupId) return

    const fromGroupId = trainee.groupId
    const toGroup = groups.find(g => g.id === targetGroupId)
    const fromGroup = groups.find(g => g.id === fromGroupId)

    // Optimistic update
    setTrainees(prev => prev.map(t =>
      t.id === traineeId ? { ...t, groupId: targetGroupId } : t
    ))

    // Update DB
    await supabase
      .from('user_groups')
      .update({ group_id: targetGroupId })
      .eq('id', trainee.userGroupId)

    // Log transfer
    await supabase.from('group_transfers').insert({
      user_id: traineeId,
      from_group_id: fromGroupId,
      to_group_id: targetGroupId,
    })

    // Send push + log
    const msg = `הועברת מ${fromGroup?.name ?? 'הקבוצה הקודמת'} ל${toGroup?.name ?? 'קבוצה חדשה'}`
    await Promise.all([
      sendPush([traineeId], '🔄 שינוי קבוצה', msg),
      supabase.from('notifications_log').insert({
        user_id: traineeId,
        message: msg,
        type: 'group_transfer',
      }),
    ])
  }

  const addTraineeToGroup = async (userId: string, groupId: string) => {
    await supabase.from('user_groups').insert({ user_id: userId, group_id: groupId })
    await load()
  }

  const removeTraineeFromGroup = async (trainee: TraineeWithGroup) => {
    await supabase.from('user_groups').delete().eq('id', trainee.userGroupId)
    await load()
  }

  const addGroup = async () => {
    if (!newGroupName.trim()) return
    await supabase.from('groups').insert({ name: newGroupName.trim() })
    setNewGroupName('')
    setShowAddGroup(false)
    await load()
  }

  const activeTrainee = trainees.find(t => t.id === activeId)

  if (loading) {
    return (
      <main className="page items-center justify-center">
        <div className="text-4xl animate-bounce">👥</div>
        <p className="text-slate-400 mt-3">טוען...</p>
      </main>
    )
  }

  return (
    <main>
      <header className="bg-primary-600 text-white px-5 pt-12 pb-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">ניהול קבוצות</h1>
          <p className="text-primary-200 text-sm mt-1">גרור מתאמן בין קבוצות להעברה</p>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {groups.map(group => (
            <GroupDropZone
              key={group.id}
              group={group}
              trainees={trainees.filter(t => t.groupId === group.id)}
              activeId={activeId}
            />
          ))}

          <DragOverlay>
            {activeTrainee ? (
              <div className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2 shadow-xl border-2 border-primary-300">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600">
                  {(activeTrainee.name ?? activeTrainee.phone).slice(0, 1)}
                </div>
                <p className="text-sm font-semibold">{activeTrainee.name ?? 'ללא שם'}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Unassigned trainees */}
        {unassigned.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-slate-700 mb-3">⚠️ לא משויכים לקבוצה ({unassigned.length})</h3>
            <div className="space-y-2">
              {unassigned.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="flex-1 text-sm text-slate-600">
                    {t.name ?? t.phone}
                  </div>
                  {groups.length > 0 && (
                    <select
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1"
                      defaultValue=""
                      onChange={e => e.target.value && addTraineeToGroup(t.id, e.target.value)}
                    >
                      <option value="">בחר קבוצה</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add group */}
        {showAddGroup ? (
          <div className="card">
            <input
              type="text"
              placeholder="שם הקבוצה (למשל: קבוצת 17:00)"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 mb-3 focus:outline-none focus:border-primary-400 text-slate-800"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={addGroup} className="flex-1 btn-primary py-3">הוסף</button>
              <button onClick={() => setShowAddGroup(false)} className="flex-1 btn-ghost py-3">ביטול</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddGroup(true)} className="btn-ghost">
            ➕ הוסף קבוצה
          </button>
        )}
      </div>
    </main>
  )
}
