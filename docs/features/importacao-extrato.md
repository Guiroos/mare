# Importação de Extrato Bancário

## Problema / Contexto

Lançamento manual é o maior ponto de fricção em qualquer app de finanças pessoais. A importação de extratos no formato OFX (padrão dos bancos brasileiros) ou CSV eliminaria o trabalho repetitivo para quem quer manter o app atualizado com fidelidade. Mobills suporta OFX, CSV, XLS e PDF.

## O que já temos

- Schema de `transactions` com todos os campos necessários para receber dados importados
- Categorias já configuradas pelo usuário — base para mapeamento automático
- `paymentAccounts` já identifica a conta de destino

## MVP — como fazer

**Fluxo de importação em 3 passos:**

**1. Upload:** página `/registro/importar` com drag-and-drop de arquivo `.ofx` ou `.csv`. Parse no servidor (Node.js — sem biblioteca externa para OFX simples, ou `ofx-js` se necessário).

**2. Revisão:** tabela com todas as transações extraídas. Para cada linha: data, descrição, valor, e um `<Select>` de categoria pré-sugerida (heurística por descrição). O usuário ajusta antes de confirmar.

**3. Importação:** ao confirmar, batch insert de todas as transações. Dedup por `(date, amount, description)` — transações já existentes são marcadas como duplicatas e puladas.

**Formatos suportados no MVP:**
- OFX (Itaú, Bradesco, Santander exportam nativamente)
- CSV com colunas configuráveis (Nubank, Inter usam CSV)

**Categorização automática heurística:** mapa de palavras-chave → categoria. Ex: "IFOOD" → Alimentação. Configurável pelo usuário ao longo do tempo.

## Fora do MVP

- Importação de PDF (OCR — muito complexo)
- Open Banking / sync automático via API bancária
- Aprendizado automático de categorias por ML
- Importação de investimentos (notas de corretagem)
- Dedup inteligente com similaridade de descrição
