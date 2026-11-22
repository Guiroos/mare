import { TxList, TxGroupHeader, TxItem, ListFooter } from 'mare'

export const Lancamentos = () => (
  <TxList>
    <TxGroupHeader date="Quinta, 7 de agosto" total="− R$ 312,40" />
    <TxItem
      dot="M"
      dotBg="oklch(94% 0.04 225)"
      dotColor="oklch(38% 0.12 230)"
      name="Mercado Pão de Açúcar"
      meta="Mercado · Nubank"
      amount="− R$ 248,90"
      amountTone="neg"
    />
    <TxItem
      dot="U"
      dotBg="oklch(96% 0.04 75)"
      dotColor="oklch(42% 0.12 70)"
      name="Uber para o aeroporto"
      meta="Transporte · Nubank"
      amount="− R$ 63,50"
      amountTone="neg"
    />
    <TxGroupHeader date="Quarta, 6 de agosto" total="+ R$ 5.200,00" />
    <TxItem
      dot="S"
      dotBg="oklch(94% 0.04 170)"
      dotColor="oklch(36% 0.11 170)"
      name="Salário"
      meta="Entrada · Itaú"
      amount="+ R$ 5.200,00"
      amountTone="pos"
    />
    <ListFooter label="Saldo do período" value="+ R$ 4.887,60" />
  </TxList>
)

export const ComParcelas = () => (
  <TxList>
    <TxGroupHeader date="Agosto 2026" />
    <TxItem
      dot="N"
      dotBg="oklch(94% 0.04 225)"
      dotColor="oklch(38% 0.12 230)"
      name="Notebook Dell"
      meta="Eletrônicos · Nubank"
      installment="3/10"
      amount="− R$ 620,00"
      amountTone="neg"
    />
    <TxItem
      dot="C"
      dotBg="oklch(95% 0.04 20)"
      dotColor="oklch(38% 0.12 22)"
      name="Cadeira ergonômica"
      meta="Casa · Nubank"
      installment="7/12"
      amount="− R$ 158,25"
      amountTone="neg"
    />
    <TxItem
      dot="P"
      dotBg="oklch(94.5% 0.012 222)"
      dotColor="oklch(48% 0.018 228)"
      name="Passagem cancelada"
      meta="Viagem · Itaú"
      amount="− R$ 980,00"
      strike
    />
    <ListFooter label="Total em parcelas" value="− R$ 778,25" />
  </TxList>
)
