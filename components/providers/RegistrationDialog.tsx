'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { getRegistrationFormData } from '@/lib/actions/form-data';

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

type InvestmentType = {
  id: string;
  name: string;
};

type RegistrationDialogCtx = {
  open: (month?: string) => void;
};

const ctx = createContext<RegistrationDialogCtx>({ open: () => {} });

export function useRegistrationDialog() {
  return useContext(ctx);
}

export function RegistrationDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState<string | undefined>();
  const [formData, setFormData] = useState<{
    categoryGroups: CategoryGroup[];
    accounts: Account[];
    investmentTypes: InvestmentType[];
  } | null>(null);

  const openDialog = useCallback((defaultMonth?: string) => {
    setMonth(defaultMonth);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (isOpen && !formData) {
      getRegistrationFormData().then(setFormData);
    }
  }, [isOpen, formData]);

  return (
    <ctx.Provider value={{ open: openDialog }}>
      {children}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md w-full max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>

          {!formData ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <TransactionForm
              categoryGroups={formData.categoryGroups}
              accounts={formData.accounts}
              investmentTypes={formData.investmentTypes}
              defaultMonth={month}
              onSuccess={() => setIsOpen(false)}
              showFullPageLink
            />
          )}
        </DialogContent>
      </Dialog>
    </ctx.Provider>
  );
}
