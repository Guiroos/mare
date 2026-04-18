export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    'pt-BR',
    { month: 'long', year: 'numeric' }
  );
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function yearMonthToReferenceMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

export function referenceMonthToYearMonth(referenceMonth: string): string {
  return referenceMonth.slice(0, 7);
}

export function prevMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nextMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
