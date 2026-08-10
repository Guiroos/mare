import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Button,
  Field,
  Input,
  CurrencyInput,
} from 'mare'

export const Confirmacao = () => (
  <Drawer open modal={false} shouldScaleBackground={false}>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Excluir gasto fixo</DrawerTitle>
        <p className="text-body text-text-secondary">
          O gasto some deste mês e dos próximos. Meses anteriores não mudam.
        </p>
      </DrawerHeader>
      <div className="flex flex-col gap-2 p-4">
        <Button variant="danger">Excluir</Button>
        <Button variant="ghost">Cancelar</Button>
      </div>
    </DrawerContent>
  </Drawer>
)

export const Formulario = () => (
  <Drawer open modal={false} shouldScaleBackground={false}>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Novo lançamento</DrawerTitle>
      </DrawerHeader>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <Field label="Descrição" required>
          <Input defaultValue="Uber para o aeroporto" />
        </Field>
        <Field label="Valor" required>
          <CurrencyInput name="amount" defaultValue="63.50" />
        </Field>
        <Button>Salvar</Button>
      </div>
    </DrawerContent>
  </Drawer>
)
