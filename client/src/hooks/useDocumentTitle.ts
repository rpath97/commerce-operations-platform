import { useEffect } from 'react'

const LEGACY_APP_NAME = 'CommerceOps'
const APP_NAME = 'Noryx'

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title.replaceAll(LEGACY_APP_NAME, APP_NAME)
    return () => {
      document.title = APP_NAME
    }
  }, [title])
}
