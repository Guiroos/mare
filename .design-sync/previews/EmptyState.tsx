import { EmptyState, Button } from 'mare'
import { Receipt, Users, Search, Plus } from 'lucide-react'

export const Basico = () => (
  <EmptyState
    icon={<Receipt />}
    title="Nenhum lançamento em agosto"
    description="Registre a primeira saída ou entrada para o mês começar a fazer sentido."
  />
)

export const ComAcao = () => (
  <EmptyState
    icon={<Users />}
    title="Ninguém te deve nada"
    description="Cadastre uma pessoa para começar a registrar cobranças e pagamentos."
    action={<Button leftIcon={<Plus className="h-4 w-4" />}>Cadastrar pessoa</Button>}
  />
)

export const Boxed = () => (
  <EmptyState
    boxed
    icon={<Search />}
    title="Nenhum resultado"
    description="Nenhum lançamento bate com esses filtros. Tente ampliar o período."
    action={
      <Button variant="ghost" size="sm">
        Limpar filtros
      </Button>
    }
  />
)

export const SemIcone = () => (
  <EmptyState
    title="Sem investimentos ativos"
    description="Tipos de investimento com saldo zerado ficam fora desta lista."
  />
)
