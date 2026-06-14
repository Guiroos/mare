'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLayout } from '@/components/ui/page-layout'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageLayout>
      <EmptyState
        title="Algo deu errado"
        description="Ocorreu um erro inesperado. Tente novamente."
        action={
          <Button variant="secondary" onClick={reset}>
            Tentar novamente
          </Button>
        }
      />
    </PageLayout>
  )
}
