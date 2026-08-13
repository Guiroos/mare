'use client'

import { useState } from 'react'
import { Link2, MessageCircle } from 'lucide-react'
import { RowActions } from '@/components/ui/row-actions'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { CobrancaDialog } from '@/components/devedores/CobrancaDialog'
import { ShareLinkDialog } from '@/components/devedores/ShareLinkDialog'
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
  shareUrl: string | null
}

export function DevedorDetailActions({
  person,
  balance,
  openCharges,
  pixKey,
  shareUrl,
}: DevedorDetailActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [cobrancaOpen, setCobrancaOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

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
          {
            label: 'Compartilhar extrato',
            icon: Link2,
            onClick: () => setShareOpen(true),
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

      <ShareLinkDialog
        personId={person.id}
        initialUrl={shareUrl}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  )
}
