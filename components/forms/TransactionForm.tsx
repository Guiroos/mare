'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
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
import { upsertInvestment, createWithdrawal } from '@/lib/actions/investments';

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

type FormType = 'avulso' | 'fixo' | 'parcelado' | 'entrada' | 'investimento' | 'resgate';

const TABS: { value: FormType; label: string }[] = [
  { value: 'avulso', label: 'Gasto avulso' },
  { value: 'fixo', label: 'Gasto fixo' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'entrada', label: 'Entrada' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'resgate', label: 'Resgate' },
];

type InvestmentType = {
  id: string;
  name: string;
};

type Props = {
  categoryGroups: CategoryGroup[];
  accounts: Account[];
  investmentTypes?: InvestmentType[];
  defaultMonth?: string;
  onSuccess?: () => void;
  showFullPageLink?: boolean;
};

export function TransactionForm({
  categoryGroups,
  accounts,
  investmentTypes = [],
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
        } else if (type === 'investimento') {
          await upsertInvestment({
            investmentTypeId: str('investmentTypeId'),
            referenceMonth: str('referenceMonth') + '-01',
            amount: str('amount') || null,
            yieldAmount: str('yieldAmount') || null,
            notes: str('notes') || null,
          });
        } else if (type === 'resgate') {
          await createWithdrawal({
            investmentTypeId: str('investmentTypeId'),
            amount: str('amount'),
            date: str('date'),
            destination: str('destination') as 'income' | 'transfer',
            notes: str('notes') || null,
          });
        }
        resetForm();
        onSuccess?.();
      } catch {
        setError('Erro ao salvar. Tente novamente.');
      }
    });
  };

  const isExpense = type !== 'entrada' && type !== 'investimento' && type !== 'resgate';

  return (
    <div className="space-y-5">
      {/* Tipo */}
      <div className="grid grid-cols-3 rounded-lg border p-1 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setType(tab.value); resetForm(); }}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-center',
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
        {/* Nome / Origem — só para gastos e entradas */}
        {(type === 'avulso' || type === 'fixo' || type === 'parcelado' || type === 'entrada') && (
          <Field label={type === 'entrada' ? 'Origem' : 'Nome'}>
            <Input
              name={type === 'entrada' ? 'source' : 'name'}
              placeholder={type === 'entrada' ? 'Ex: Salário, Vale...' : 'Ex: Mercado, Netflix...'}
              required
              autoFocus
            />
          </Field>
        )}

        {/* Tipo de investimento — para investimento e resgate */}
        {(type === 'investimento' || type === 'resgate') && (
          <Field label="Tipo de investimento">
            <Select name="investmentTypeId" required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {investmentTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Valor */}
        {type !== 'investimento' && (
          <Field label={type === 'parcelado' ? 'Valor total' : 'Valor'}>
            <CurrencyInput
              name={type === 'parcelado' ? 'totalAmount' : 'amount'}
              required
            />
          </Field>
        )}

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

        {type === 'entrada' && (
          <Field label="Mês de referência">
            <Input name="referenceMonth" type="month" defaultValue={month} required />
          </Field>
        )}

        {type === 'investimento' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aporte (R$)">
                <CurrencyInput name="amount" autoFocus />
              </Field>
              <Field label="Rendimento (R$)">
                <CurrencyInput name="yieldAmount" />
              </Field>
            </div>
            <Field label="Mês de referência">
              <Input name="referenceMonth" type="month" defaultValue={month} required />
            </Field>
            <Field label="Observações">
              <Input name="notes" placeholder="Opcional" />
            </Field>
          </>
        )}

        {type === 'resgate' && (
          <>
            <Field label="Data do resgate">
              <Input name="date" type="date" defaultValue={today} required />
            </Field>
            <Field label="Destino">
              <Select name="destination" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Caixa (lançar como entrada)</SelectItem>
                  <SelectItem value="transfer">Transferência entre investimentos</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Observações">
              <Input name="notes" placeholder="Opcional" />
            </Field>
          </>
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
