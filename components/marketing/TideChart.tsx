/**
 * Curva de saldo mensal desenhada como tábua de maré.
 *
 * Server Component puro: a geometria é calculada em build time e sai como SVG
 * no HTML. O protótipo montava o SVG via DOM no cliente; aqui isso viraria um
 * client component e um bloco de JS no caminho crítico do LCP, que é o alvo
 * mais apertado desta página. Recharts está fora pelo mesmo motivo.
 *
 * Os valores são ilustrativos e representativos do produto — não vêm do banco.
 */

const MONTHS = ['set', 'out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago']
const VALUES = [1240, 2100, -480, 860, 3200, 1750, -1100, 640, 2480, 3960, 2210, 4380]
const LEVELS = [4000, 2000, 0, -2000]

const W = 980
const H = 330
const PAD = { left: 54, right: 62, top: 26, bottom: 44 }
const MAX_AMPLITUDE = 4800

const midY = PAD.top + (H - PAD.top - PAD.bottom) / 2
const halfHeight = (H - PAD.top - PAD.bottom) / 2

const scaleY = (value: number) => midY - (value / MAX_AMPLITUDE) * halfHeight
const scaleX = (index: number) =>
  PAD.left + index * ((W - PAD.left - PAD.right) / (VALUES.length - 1))

const zeroY = scaleY(0)

/**
 * Curva suave via cúbicas com pontos de controle no ponto médio horizontal —
 * mesma técnica do protótipo. Mantém a monotonicidade entre pontos, então a
 * curva nunca inventa um pico que os dados não têm.
 */
function buildPath(closed: boolean) {
  let d = `M${scaleX(0)} ${scaleY(VALUES[0])}`
  for (let i = 0; i < VALUES.length - 1; i++) {
    const x1 = scaleX(i)
    const y1 = scaleY(VALUES[i])
    const x2 = scaleX(i + 1)
    const y2 = scaleY(VALUES[i + 1])
    const cx = (x1 + x2) / 2
    d += ` C${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`
  }
  if (closed) {
    d += ` L${scaleX(VALUES.length - 1)} ${zeroY} L${scaleX(0)} ${zeroY} Z`
  }
  return d
}

const linePath = buildPath(false)
const areaPath = buildPath(true)

const lastIndex = VALUES.length - 1
const markerX = scaleX(lastIndex)
const markerY = scaleY(VALUES[lastIndex])

export function TideChart() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Gráfico do saldo mensal dos últimos doze meses, alternando entre períodos positivos e negativos, com agosto de 2026 em destaque."
      className="block w-full"
    >
      <defs>
        {/* Recorta a curva na linha do zero: acima é maré alta, abaixo é maré baixa */}
        <clipPath id="tide-above">
          <rect x="0" y="0" width={W} height={zeroY} />
        </clipPath>
        <clipPath id="tide-below">
          <rect x="0" y={zeroY} width={W} height={H - zeroY} />
        </clipPath>
      </defs>

      {/* Níveis da tábua de maré */}
      {LEVELS.map((level) => {
        const y = scaleY(level)
        const isZero = level === 0
        return (
          <g key={level}>
            <line
              x1={PAD.left - 14}
              x2={W - PAD.right + 8}
              y1={y}
              y2={y}
              className={isZero ? 'stroke-border-strong' : 'stroke-border'}
              strokeWidth={1}
              strokeDasharray={isZero ? undefined : '2 5'}
            />
            <text
              x={W - PAD.right + 16}
              y={y + 4}
              className="fill-text-tertiary font-mono text-[11px]"
            >
              {level > 0 ? '+' : ''}
              {level / 1000}k
            </text>
          </g>
        )
      })}

      {/* Marcações verticais tipo régua de cais */}
      {MONTHS.map((month, i) => (
        <g key={month}>
          <line
            x1={scaleX(i)}
            x2={scaleX(i)}
            y1={H - PAD.bottom + 4}
            y2={H - PAD.bottom + (i % 3 === 0 ? 13 : 8)}
            className="stroke-border"
            strokeWidth={1}
          />
          <text
            x={scaleX(i)}
            y={H - PAD.bottom + 28}
            textAnchor="middle"
            className={
              i === lastIndex
                ? 'fill-text-primary font-mono text-[11px] font-medium'
                : 'fill-text-tertiary font-mono text-[11px]'
            }
          >
            {month}
          </text>
        </g>
      ))}

      <path d={areaPath} className="fill-positive" fillOpacity={0.13} clipPath="url(#tide-above)" />
      <path d={areaPath} className="fill-negative" fillOpacity={0.13} clipPath="url(#tide-below)" />
      <path
        d={linePath}
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-positive"
        clipPath="url(#tide-above)"
      />
      <path
        d={linePath}
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-negative"
        clipPath="url(#tide-below)"
      />

      {/* Mês corrente */}
      <g className="motion-safe:animate-tide-marker">
        <line
          x1={markerX}
          x2={markerX}
          y1={markerY}
          y2={H - PAD.bottom}
          className="stroke-positive"
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.6}
        />
        <circle
          cx={markerX}
          cy={markerY}
          r={6}
          className="fill-bg-surface stroke-positive"
          strokeWidth={2.5}
        />
        <text
          x={markerX}
          y={markerY - 16}
          textAnchor="end"
          className="fill-positive font-mono text-[11px] font-medium"
        >
          ago · +4.380
        </text>
      </g>

      {/* Cortina de entrada. `motion-safe` cobre prefers-reduced-motion; sem a
          animação o rect fica parado sobre o gráfico, então ele só existe
          quando a animação existe. */}
      <rect
        x="0"
        y="0"
        width={W}
        height={H}
        className="hidden fill-bg-surface motion-safe:block motion-safe:animate-tide-reveal"
      />
    </svg>
  )
}
