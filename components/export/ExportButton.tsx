import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ExportButtonProps = {
  /** URL da rota de exportação, com os filtros já serializados. */
  href: string
  label?: string
}

export function ExportButton({ href, label = 'Exportar' }: ExportButtonProps) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} download>
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </a>
    </Button>
  )
}
