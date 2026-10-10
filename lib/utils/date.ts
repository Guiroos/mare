import {
  format,
  addMonths,
  subMonths,
  subDays,
  addDays,
  startOfMonth,
  parseISO,
  getYear,
  getMonth,
  getDate,
  setDate,
  differenceInCalendarDays,
  endOfMonth,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { z } from 'zod'

// Wrapper interno: elimina a repetição de { locale: ptBR } nas funções de formatação.
// Não usa setDefaultOptions para evitar mutação de estado global (incompatível com Server Components).
const fmt = (date: Date, formatStr: string) => format(date, formatStr, { locale: ptBR })

/** Parses a YYYY-MM-DD string safely (avoids UTC offset day shifting). */
export function parseDate(dateStr: string): Date {
  return parseISO(dateStr + 'T12:00:00')
}

/** Returns the last day of a YYYY-MM month as YYYY-MM-DD. */
export function lastDayOfYearMonth(yearMonth: string): string {
  return format(endOfMonth(parseDate(yearMonth + '-01')), 'yyyy-MM-dd')
}

/** Returns the current date as YYYY-MM. */
export function currentYearMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

/** Returns the current month as YYYY-MM-01 (referenceMonth format for DB). */
export function currentReferenceMonth(): string {
  return format(startOfMonth(new Date()), 'yyyy-MM-dd')
}

/** Returns the current year as a number. */
export function currentYear(): number {
  return getYear(new Date())
}

/** Returns today's day, month and year as integers. */
export function todayParts(): { day: number; month: number; year: number } {
  const now = new Date()
  return { day: getDate(now), month: getMonth(now) + 1, year: getYear(now) }
}

/** Returns today's date as YYYY-MM-DD, safe for use as an HTML date input default. */
export function todayISOString(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Converts YYYY-MM to YYYY-MM-01 (referenceMonth format for DB). */
export function yearMonthToReferenceMonth(yearMonth: string): string {
  return `${yearMonth}-01`
}

/** Normaliza um YYYY-MM vindo de URL; cai no mês atual se ausente ou inválido (ex: "2025-13", "0000-01"). */
export function normalizeYearMonthParam(raw: string | undefined): string {
  if (!raw) return currentYearMonth()
  if (!z.string().date().safeParse(`${raw}-01`).success) return currentYearMonth()
  return Number(raw.slice(0, 4)) > 2000 ? raw : currentYearMonth()
}

/**
 * Normaliza um ?year= vindo de URL; cai no ano atual se ausente ou fora do domínio.
 * Piso (> 2000) e teto (<= 9999) espelham normalizeYearMonthParam, que aplica o mesmo
 * par via z.string().date() — ver #83.
 */
export function normalizeYearParam(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isInteger(parsed) && parsed > 2000 && parsed <= 9999 ? parsed : currentYear()
}

/** Converts YYYY-MM-01 to YYYY-MM. */
export function referenceMonthToYearMonth(referenceMonth: string): string {
  return referenceMonth.slice(0, 7)
}

/** Converts a YYYY-MM-DD date string to the YYYY-MM-01 referenceMonth for that month. */
export function dateToReferenceMonth(dateStr: string): string {
  return format(startOfMonth(parseDate(dateStr)), 'yyyy-MM-dd')
}

/** Returns yearMonth plus n months (negative walks back), as YYYY-MM. */
export function addMonthsToYearMonth(yearMonth: string, n: number): string {
  return format(addMonths(parseISO(`${yearMonth}-01`), n), 'yyyy-MM')
}

/** Returns the previous month as YYYY-MM. */
export function prevMonth(yearMonth: string): string {
  return addMonthsToYearMonth(yearMonth, -1)
}

/** Returns the next month as YYYY-MM. */
export function nextMonth(yearMonth: string): string {
  return addMonthsToYearMonth(yearMonth, 1)
}

/**
 * Returns the YYYY-MM in which the last of `remainingInstallments` installments lands,
 * anchored on `nextChargeMonth` (the month of the next pending installment). Falls back to
 * the current month when there is no pending installment (`nextChargeMonth === null`).
 */
export function installmentEndYearMonth(
  nextChargeMonth: string | null,
  remainingInstallments: number
): string {
  return addMonthsToYearMonth(nextChargeMonth ?? currentYearMonth(), remainingInstallments - 1)
}

/** Formats a YYYY-MM as "janeiro de 2025" (pt-BR). */
export function formatMonthName(yearMonth: string): string {
  return fmt(parseISO(`${yearMonth}-01`), "MMMM 'de' yyyy")
}

/** Formats a YYYY-MM as "Janeiro 2025" (capitalized, pt-BR). */
export function formatMonthYear(yearMonth: string): string {
  const str = fmt(parseISO(`${yearMonth}-01`), 'MMMM yyyy')
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Retorna uma lista de YYYY-MM centrada em centerYearMonth, com `back` meses antes e `forward` depois (crescente). */
export function monthOptions(centerYearMonth: string, back: number, forward: number): string[] {
  const center = parseISO(`${centerYearMonth}-01`)
  const result: string[] = []
  for (let i = back; i >= 1; i--) result.push(format(subMonths(center, i), 'yyyy-MM'))
  result.push(format(center, 'yyyy-MM'))
  for (let i = 1; i <= forward; i++) result.push(format(addMonths(center, i), 'yyyy-MM'))
  return result
}

/**
 * Reduces YYYY-MM-DD dates to their distinct YYYY-MM months, newest first.
 * Shared by every month filter derived from entry dates so the months shown in
 * two places can't drift apart.
 */
export function uniqueMonthsFromDates(dates: string[]): string[] {
  const months = new Set(dates.map((d) => d.slice(0, 7)))
  return [...months].sort((a, b) => b.localeCompare(a))
}

/** Formats a YYYY-MM as a short chart label, e.g. "jan 25" (pt-BR). */
export function formatMonthShort(yearMonth: string): string {
  return fmt(parseISO(`${yearMonth}-01`), 'MMM yy')
}

/** Formats a YYYY-MM as the 3-letter month abbreviation, e.g. "jan" (pt-BR). */
export function formatMonthAbbr(yearMonth: string): string {
  return fmt(parseISO(`${yearMonth}-01`), 'MMM')
}

/** Formats a YYYY-MM-DD date string for display, e.g. "15 de jan." (pt-BR). */
export function formatDisplayDate(dateStr: string): string {
  return fmt(parseDate(dateStr), "d 'de' MMM.")
}

/** Formats a YYYY-MM-DD date string as dd/MM/yyyy, e.g. "15/01/2025" (pt-BR). */
export function formatDate(dateStr: string): string {
  return format(parseDate(dateStr), 'dd/MM/yyyy')
}

/** Returns how many calendar days ago the given YYYY-MM-DD date was (0 = today, 1 = yesterday). */
export function daysAgo(dateStr: string): number {
  return differenceInCalendarDays(new Date(), parseDate(dateStr))
}

/** Returns number of calendar days until dateStr (positive = future, negative = past). */
export function daysUntil(dateStr: string): number {
  return differenceInCalendarDays(parseDate(dateStr), new Date())
}

/** Returns an array of N past referenceMonths (YYYY-MM-01), oldest first, ending with current month. */
export function pastNMonths(n: number): string[] {
  const start = startOfMonth(new Date())
  return Array.from({ length: n }, (_, i) => format(subMonths(start, n - 1 - i), 'yyyy-MM-dd'))
}

/** Returns an array of N referenceMonths (YYYY-MM-01) starting from the current month. */
export function futureNMonths(n: number): string[] {
  const start = startOfMonth(new Date())
  return Array.from({ length: n }, (_, i) => format(addMonths(start, i), 'yyyy-MM-dd'))
}

/**
 * Returns the first day of the billing cycle that starts in `yearMonth`: the closingDay
 * of the previous month, clamped to that month's last day when it's shorter.
 */
function cycleStartDate(yearMonth: string, closingDay: number): Date {
  const currentFirst = parseISO(`${yearMonth}-01`)
  const prevFirst = subMonths(currentFirst, 1)
  const prevMonthLastDay = new Date(prevFirst.getFullYear(), prevFirst.getMonth() + 1, 0).getDate()
  const startDay = Math.min(closingDay, prevMonthLastDay)
  return new Date(prevFirst.getFullYear(), prevFirst.getMonth(), startDay)
}

/**
 * Calculates the billing cycle date range for a given month and credit card closing day.
 *
 * The closing day is the FIRST day of the new billing cycle, so the previous cycle ends
 * on (closingDay - 1). Example with closingDay=8 and yearMonth="2025-03":
 *   start = 2025-02-08, end = 2025-03-07, label = "08/fev → 07/mar"
 *
 * `end` is derived from the START of the NEXT cycle (minus one day), not from its own
 * clamp against the current month's last day — the two clamps used to be independent and
 * could land on the same day when closingDay is 29-31, making consecutive cycles overlap
 * by one day (see #91). Deriving `end` this way makes the partition hold by construction.
 *
 * Returns null if closingDay <= 1 (calendar month behavior should be used instead).
 */
export function billingCycleDateRange(
  yearMonth: string,
  closingDay: number
): { start: string; end: string; label: string } | null {
  if (closingDay <= 1) return null

  const start = cycleStartDate(yearMonth, closingDay)
  const end = subDays(cycleStartDate(nextMonth(yearMonth), closingDay), 1)

  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')
  const label = `${format(start, 'dd/MMM', { locale: ptBR })} → ${format(end, 'dd/MMM', { locale: ptBR })}`

  return { start: startStr, end: endStr, label }
}

/**
 * Returns the yearMonth of the billing cycle that contains `date` (YYYY-MM-DD). Compares the
 * full date against the START of the next cycle (from billingCycleDateRange) instead of the
 * raw day-of-month against closingDay: a raw comparison can't track the clamp
 * billingCycleDateRange applies when closingDay exceeds the month's length (e.g. closingDay=31
 * in February) — see #90/#91/#173. Callers guarantee closingDay > 1.
 */
function billingCycleYearMonthOf(date: string, closingDay: number): string {
  const yearMonth = date.slice(0, 7)
  const nextCycleStart = billingCycleDateRange(nextMonth(yearMonth), closingDay)!.start
  return date < nextCycleStart ? yearMonth : nextMonth(yearMonth)
}

/**
 * Returns the yearMonth of the billing cycle currently open (not yet closed) and the one
 * most recently closed, as of today. Returns null for closingDay <= 1, matching
 * billingCycleDateRange's contract (calendar month behavior should be used instead) — the
 * two are meant to be chained (`billingCycleDateRange(currentBillingCycleYearMonths(cd)!.openYearMonth, cd)`),
 * so they share the same closingDay <= 1 guard instead of one returning null and the other a
 * value that isn't pairable with it.
 */
export function currentBillingCycleYearMonths(closingDay: number): {
  openYearMonth: string
  closedYearMonth: string
} | null {
  if (closingDay <= 1) return null

  const openYearMonth = billingCycleYearMonthOf(todayISOString(), closingDay)
  return { openYearMonth, closedYearMonth: prevMonth(openYearMonth) }
}

/**
 * Cutoff that assigns a fixed expense to a billing cycle: a fixed expense referenced in
 * `yearMonth` with dueDay < cutoff belongs to the cycle `yearMonth`; with dueDay >= cutoff,
 * to `nextMonth(yearMonth)`. The cutoff is the day the next cycle starts — closingDay clamped
 * to the month's length, from the same cycleStartDate billingCycleDateRange uses. Comparing
 * dueDay against the raw closingDay disagrees with the clamp when closingDay is 29-31 in a
 * shorter month: a fixed expense due on Feb 28 with closingDay=31 would land in February's
 * cycle while a transaction on the same day lands in March's (see #91/#173).
 */
export function fixedExpenseCycleCutoff(yearMonth: string, closingDay: number): number {
  return getDate(cycleStartDate(nextMonth(yearMonth), closingDay))
}

/**
 * Returns the referenceMonth base for installment 1: the month of the billing cycle that
 * contains the purchase (billingCycleYearMonthOf). closingDay is the first day of the new
 * cycle, so a purchase ON the closing day already belongs to the next month (#90).
 */
export function calcBaseReferenceMonth(purchaseDate: Date, closingDay: number | null): Date {
  const effectiveClosingDay = closingDay !== null && closingDay > 1 ? closingDay : null
  if (effectiveClosingDay === null) return startOfMonth(purchaseDate)
  const yearMonth = billingCycleYearMonthOf(format(purchaseDate, 'yyyy-MM-dd'), effectiveClosingDay)
  return parseISO(`${yearMonth}-01`)
}

/**
 * Returns the date for installments 2+ (i > 0): the second day of referenceMonth's billing
 * cycle, derived from the same cycleStartDate as billingCycleDateRange so it always falls inside
 * the cycle. Equals closingDay + 1 of the previous month, or day 1 of referenceMonth when
 * closingDay is the previous month's last day (or beyond it) — the second day, not the first,
 * keeps new installments on the same dates as the ones already stored.
 */
export function calcInstallmentDate(referenceMonth: Date, closingDay: number | null): Date {
  const effectiveClosingDay = closingDay !== null && closingDay > 1 ? closingDay : null
  if (effectiveClosingDay === null) {
    return setDate(referenceMonth, 1)
  }
  return addDays(cycleStartDate(format(referenceMonth, 'yyyy-MM'), effectiveClosingDay), 1)
}
