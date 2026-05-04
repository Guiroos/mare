import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  parseISO,
  getYear,
  getMonth,
  getDate,
  differenceInCalendarDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Wrapper interno: elimina a repetição de { locale: ptBR } nas funções de formatação.
// Não usa setDefaultOptions para evitar mutação de estado global (incompatível com Server Components).
const fmt = (date: Date, formatStr: string) => format(date, formatStr, { locale: ptBR })

/** Parses a YYYY-MM-DD string safely (avoids UTC offset day shifting). */
export function parseDate(dateStr: string): Date {
  return parseISO(dateStr + 'T12:00:00')
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

/** Converts YYYY-MM-01 to YYYY-MM. */
export function referenceMonthToYearMonth(referenceMonth: string): string {
  return referenceMonth.slice(0, 7)
}

/** Converts a YYYY-MM-DD date string to the YYYY-MM-01 referenceMonth for that month. */
export function dateToReferenceMonth(dateStr: string): string {
  return format(startOfMonth(parseDate(dateStr)), 'yyyy-MM-dd')
}

/** Returns the previous month as YYYY-MM. */
export function prevMonth(yearMonth: string): string {
  return format(subMonths(parseISO(`${yearMonth}-01`), 1), 'yyyy-MM')
}

/** Returns the next month as YYYY-MM. */
export function nextMonth(yearMonth: string): string {
  return format(addMonths(parseISO(`${yearMonth}-01`), 1), 'yyyy-MM')
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
 * Calculates the billing cycle date range for a given month and credit card closing day.
 *
 * The closing day is the FIRST day of the new billing cycle, so the previous cycle ends
 * on (closingDay - 1). Example with closingDay=8 and yearMonth="2025-03":
 *   start = 2025-02-08, end = 2025-03-07, label = "08/fev → 07/mar"
 *
 * Returns null if closingDay <= 1 (calendar month behavior should be used instead).
 */
export function billingCycleDateRange(
  yearMonth: string,
  closingDay: number
): { start: string; end: string; label: string } | null {
  if (closingDay <= 1) return null

  const currentFirst = parseISO(`${yearMonth}-01`)
  const prevFirst = subMonths(currentFirst, 1)

  // start = closingDay of previous month (clamped to last day of that month)
  const prevMonthLastDay = new Date(prevFirst.getFullYear(), prevFirst.getMonth() + 1, 0).getDate()
  const startDay = Math.min(closingDay, prevMonthLastDay)
  const startStr = format(
    new Date(prevFirst.getFullYear(), prevFirst.getMonth(), startDay),
    'yyyy-MM-dd'
  )

  // end = (closingDay - 1) of current month (clamped to last day of that month)
  const currMonthLastDay = new Date(
    currentFirst.getFullYear(),
    currentFirst.getMonth() + 1,
    0
  ).getDate()
  const endDay = Math.min(closingDay - 1, currMonthLastDay)
  const endStr = format(
    new Date(currentFirst.getFullYear(), currentFirst.getMonth(), endDay),
    'yyyy-MM-dd'
  )

  const label = `${format(parseISO(startStr), 'dd/MMM', { locale: ptBR })} → ${format(parseISO(endStr), 'dd/MMM', { locale: ptBR })}`

  return { start: startStr, end: endStr, label }
}
