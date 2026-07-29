import { Download } from 'lucide-react'
import { Button, ButtonSize } from '@/components/ui/button'

type ExportButtonProps = {
  /** URL da rota de exportação, com os filtros já serializados. */
  href: string
  label?: string
  size?: ButtonSize
}

export function ExportButton({ href, label = 'Exportar', size = 'sm' }: ExportButtonProps) {
  return (
    <Button asChild variant="outline" size={size}>
      <a href={href} download>
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </a>
    </Button>
  )
}
