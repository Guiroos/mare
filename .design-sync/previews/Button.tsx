import { Button } from 'mare'
import { Plus, Download, ArrowRight, Trash2 } from 'lucide-react'

export const Variantes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary">Salvar lançamento</Button>
    <Button variant="secondary">Duplicar</Button>
    <Button variant="outline">Filtrar</Button>
    <Button variant="ghost">Cancelar</Button>
    <Button variant="danger">Excluir</Button>
    <Button variant="positive">Marcar como pago</Button>
    <Button variant="surface">Exportar</Button>
  </div>
)

export const Tamanhos = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="lg">Grande</Button>
    <Button size="md">Médio</Button>
    <Button size="sm">Pequeno</Button>
    <Button size="xs">Mini</Button>
    <Button size="icon" aria-label="Excluir">
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
)

export const ComIcones = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button leftIcon={<Plus className="h-4 w-4" />}>Novo lançamento</Button>
    <Button variant="surface" leftIcon={<Download className="h-4 w-4" />}>
      Baixar planilha
    </Button>
    <Button variant="ghost" rightIcon={<ArrowRight className="h-4 w-4" />}>
      Ver panorama
    </Button>
  </div>
)

export const Estados = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button loading>Salvando</Button>
    <Button disabled>Indisponível</Button>
    <Button variant="secondary" disabled>
      Sem saldo
    </Button>
  </div>
)
