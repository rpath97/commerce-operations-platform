import { useEffect } from 'react'

const APP_NAME = 'Noryx'

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
    return () => {
      document.title = APP_NAME
    }
  }, [title])
}
