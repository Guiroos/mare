'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { RowActions } from '@/components/ui/row-actions'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { CobrancaDialog } from '@/components/devedores/CobrancaDialog'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

interface DevedorDetailActionsProps {
  person: {
    id: string
    name: string
    email: string | null
    phone: string | null
    notes: string | null
  }
  balance: number
  openCharges: OpenChargeForLinking[]
  pixKey: string | null
}

export function DevedorDetailActions({
  person,
  balance,
  openCharges,
  pixKey,
}: DevedorDetailActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [cobrancaOpen, setCobrancaOpen] = useState(false)

  return (
    <>
      <RowActions
        onEdit={() => setEditOpen(true)}
        additionalActions={[
          {
            label: 'Cobrar via WhatsApp',
            icon: MessageCircle,
            onClick: () => setCobrancaOpen(true),
          },
        ]}
      />

      <PersonDialog
        mode="edit"
        person={person}
        balance={balance}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <CobrancaDialog
        person={person}
        openCharges={openCharges}
        pixKey={pixKey}
        open={cobrancaOpen}
        onOpenChange={setCobrancaOpen}
        onEditPhone={() => {
          setCobrancaOpen(false)
          setEditOpen(true)
        }}
      />
    </>
  )
}
