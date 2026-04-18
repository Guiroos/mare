'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { currentYearMonth } from '@/lib/format';
import {
  createTransaction,
  createFixedExpense,
  createInstallmentPurchase,
} from '@/lib/actions/transactions';
import { createIncome } from '@/lib/actions/incomes';

type CategoryGroup = {
  id: string;
  name: string;
  categories: { id: string; name: string }[];
};

type Account = {
  id: string;
  name: string;
  type: string;
};

type FormType = 'avulso' | 'fixo' | 'parcelado' | 'entrada';

const TABS: { value: FormType; label: string }[] = [
  { value: 'avulso', label: 'Gasto avulso' },
  { value: 'fixo', label: 'Gasto fixo' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'entrada', label: 'Entrada' },
];

type Props = {
  categoryGroups: CategoryGroup[];
  accounts: Account[];
  defaultMonth?: string;
  onSuccess?: () => void;
  showFullPageLink?: boolean;
};

export function TransactionForm({
  categoryGroups,
  accounts,
  defaultMonth,
  onSuccess,
  showFullPageLink = false,
}: Props) {
  const month = defaultMonth ?? currentYearMonth();
  const today = new Date().toISOString().split('T')[0];

  const [type, setType] = useState<FormType>('avulso');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [key, setKey] = useState(0);

  const resetForm = () => {
    setKey((k) => k + 1);
    setError('');
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);

    const str = (name: string) => (fd.get(name) as string) ?? '';

    startTransition(async () => {
      try {
        if (type === 'avulso') {
          await createTransaction({
            name: str('name'),
            amount: str('amount'),
            date: str('date'),
            categoryId: str('categoryId'),
            accountId: str('accountId'),
          });
        } else if (type === 'fixo') {
          await createFixedExpense({
            name: str('name'),
            amount: str('amount'),
            dueDay: Number(str('dueDay')),
            categoryId: str('categoryId'),
            accountId: str('accountId'),
            referenceMonth: str('referenceMonth') + '-01',
          });
        } else if (type === 'parcelado') {
          await createInstallmentPurchase({
            name: str('name'),
            totalAmount: str('totalAmount'),
            totalInstallments: Number(str('totalInstallments')),
            startDate: str('startDate'),
            categoryId: str('categoryId'),
            accountId: str('accountId'),
          });
        } else if (type === 'entrada') {
          await createIncome({
            source: str('source'),
            amount: str('amount'),
            referenceMonth: str('referenceMonth') + '-01',
          });
        }
        resetForm();
        onSuccess?.();
      } catch {
        setError('Erro ao salvar. Tente novamente.');
      }
    });
  };

  const isExpense = type !== 'entrada';

  return (
    <div className="space-y-5">
      {/* Tipo */}
      <div className="flex rounded-lg border p-1 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setType(tab.value); resetForm(); }}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              type === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form key={key} onSubmit={handleSubmit} className="space-y-4">
        {/* Nome / Origem */}
        <Field label={type === 'entrada' ? 'Origem' : 'Nome'}>
          <Input
            name={type === 'entrada' ? 'source' : 'name'}
            placeholder={type === 'entrada' ? 'Ex: Salário, Vale...' : 'Ex: Mercado, Netflix...'}
            required
            autoFocus
          />
        </Field>

        {/* Valor */}
        <Field label={type === 'parcelado' ? 'Valor total' : 'Valor'}>
          <Input
            name={type === 'parcelado' ? 'totalAmount' : 'amount'}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            required
          />
        </Field>

        {/* Campos por tipo */}
        {type === 'avulso' && (
          <Field label="Data">
            <Input name="date" type="date" defaultValue={today} required />
          </Field>
        )}

        {type === 'fixo' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia de vencimento">
              <Input name="dueDay" type="number" min="1" max="31" placeholder="Ex: 10" required />
            </Field>
            <Field label="Mês de referência">
              <Input name="referenceMonth" type="month" defaultValue={month} required />
            </Field>
          </div>
        )}

        {type === 'parcelado' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº de parcelas">
              <Input name="totalInstallments" type="number" min="2" max="60" placeholder="Ex: 12" required />
            </Field>
            <Field label="Data da 1ª parcela">
              <Input name="startDate" type="date" defaultValue={today} required />
            </Field>
          </div>
        )}

        {(type === 'fixo' || type === 'entrada') && type === 'entrada' && (
          <Field label="Mês de referência">
            <Input name="referenceMonth" type="month" defaultValue={month} required />
          </Field>
        )}

        {/* Categoria + Conta — só para gastos */}
        {isExpense && (
          <>
            <Field label="Categoria">
              <Select name="categoryId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoryGroups.map((group) => (
                    <SelectGroup key={group.id}>
                      <SelectLabel>{group.name}</SelectLabel>
                      {group.categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Conta / Cartão">
              <Select name="accountId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          {showFullPageLink && (
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/registro?month=${month}`} aria-label="Abrir formulário completo">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
