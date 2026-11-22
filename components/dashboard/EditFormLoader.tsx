'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { getRegistrationFormData } from '@/lib/actions/form-data'

type FormData = Awaited<ReturnType<typeof getRegistrationFormData>>

/** Carrega categorias/contas/viagens ao abrir o diálogo e delega o form ao render prop. */
export function EditFormLoader({ children }: { children: (data: FormData) => ReactNode }) {
  const [formData, setFormData] = useState<FormData | null>(null)

  useEffect(() => {
    getRegistrationFormData().then(setFormData)
  }, [])

  if (!formData) {
    return (
      <div className="flex items-center justify-center py-10 text-small text-text-secondary">
        Carregando...
      </div>
    )
  }

  return <>{children(formData)}</>
}
