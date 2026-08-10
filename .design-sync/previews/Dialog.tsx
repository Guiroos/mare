import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Field,
  Input,
  CurrencyInput,
  MonthSelect,
} from 'mare'

export const Confirmacao = () => (
  <Dialog open modal={false}>
    <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Excluir parcelamento</DialogTitle>
        <DialogDescription>
          Todas as 10 parcelas serão removidas, inclusive as já pagas. Essa ação não pode ser
          desfeita.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost">Cancelar</Button>
        <Button variant="danger">Excluir</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export const Formulario = () => (
  <Dialog open modal={false}>
    <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Novo gasto fixo</DialogTitle>
        <DialogDescription>
          Gastos fixos são copiados automaticamente para o mês seguinte.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <Field label="Descrição" required>
          <Input defaultValue="Plano de saúde" />
        </Field>
        <Field label="Valor" required>
          <CurrencyInput name="amount" defaultValue="421.10" />
        </Field>
        <Field label="Mês de referência" required>
          <MonthSelect name="referenceMonth" defaultValue="2026-08" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost">Cancelar</Button>
        <Button>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
