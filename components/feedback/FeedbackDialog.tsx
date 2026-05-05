'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMediaQuery } from '@/hooks/use-media-query'
import { submitFeedback } from '@/lib/actions/feedback'

type Category = 'melhoria' | 'implementacao' | 'outros'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function FeedbackForm({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [category, setCategory] = useState<Category | ''>('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ category?: string; message?: string }>({})

  function validate() {
    const next: typeof errors = {}
    if (!category) next.category = 'Selecione uma categoria'
    if (message.trim().length < 10) next.message = 'Mínimo de 10 caracteres'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    startTransition(async () => {
      try {
        await submitFeedback({
          category: category as Category,
          message: message.trim(),
          page: window.location.pathname,
        })
        toast.success('Feedback enviado. Obrigado!')
        onSuccess()
      } catch {
        toast.error('Erro ao enviar feedback.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Categoria" error={errors.category} required>
        <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
          <SelectTrigger error={!!errors.category}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="melhoria">Melhoria</SelectItem>
            <SelectItem value="implementacao">Nova funcionalidade</SelectItem>
            <SelectItem value="outros">Outros</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Mensagem" error={errors.message} required>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Descreva sua sugestão ou feedback..."
          rows={4}
          error={!!errors.message}
        />
      </Field>

      <Button type="submit" variant="primary" className="w-full" disabled={isPending}>
        {isPending ? 'Enviando...' : 'Enviar feedback'}
      </Button>
    </form>
  )
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  function handleSuccess() {
    onOpenChange(false)
  }

  const title = 'Enviar feedback'
  const form = <FeedbackForm onSuccess={handleSuccess} />

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">{form}</div>
      </DrawerContent>
    </Drawer>
  )
}
