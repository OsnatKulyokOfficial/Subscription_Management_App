'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { User } from '@/lib/types'
import TraineeHistoryModal from '@/components/TraineeHistoryModal'

interface TraineeHistoryContextType {
  openHistory: (user: User) => void
}

const TraineeHistoryContext = createContext<TraineeHistoryContextType>({ openHistory: () => {} })

export function useTraineeHistory() {
  return useContext(TraineeHistoryContext)
}

export function TraineeHistoryProvider({ children }: { children: ReactNode }) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  return (
    <TraineeHistoryContext.Provider value={{ openHistory: setSelectedUser }}>
      {children}
      <TraineeHistoryModal user={selectedUser} onClose={() => setSelectedUser(null)} />
    </TraineeHistoryContext.Provider>
  )
}
