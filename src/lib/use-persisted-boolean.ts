import { useEffect, useState } from 'react'

export function usePersistedBoolean(storageKey: string, defaultValue: boolean) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return defaultValue
    return raw === 'true'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, String(value))
  }, [storageKey, value])

  return [value, setValue] as const
}
