import { Chip } from 'mare'
import { Filter, CalendarDays, CreditCard } from 'lucide-react'

export const Estados = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Chip active>Só não pagos</Chip>
    <Chip>Só não pagos</Chip>
  </div>
)

export const FiltrosDeLista = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Chip active>Todos</Chip>
    <Chip>Saídas</Chip>
    <Chip>Entradas</Chip>
    <Chip>Parcelas</Chip>
    <Chip>Investimentos</Chip>
  </div>
)

export const ComIcone = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Chip leftIcon={<Filter className="h-3.5 w-3.5" />} active>
      Com filtro
    </Chip>
    <Chip leftIcon={<CalendarDays className="h-3.5 w-3.5" />}>Últimos 90 dias</Chip>
    <Chip leftIcon={<CreditCard className="h-3.5 w-3.5" />}>Nubank</Chip>
  </div>
)
