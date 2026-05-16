# Devedores — Issues Identificados

Levantados via walkthrough com Playwright MCP em 14/05/2026.

---

## Resolvidos

### [x] Botões de exclusão no histórico sem padrão kebab

**Problema:** `EntryRow` usava `DeleteButton` exposto para cobranças/pagamentos simples e `<Button>` com `Trash2` diretamente para pagamentos com income vinculado — esse último sem nenhuma confirmação antes de abrir o dialog.

**Solução aplicada:** `RowActions` com `onDelete` para casos simples; `additionalActions` com `variant: 'destructive'` para pagamento com income (abre `PaymentWithIncomeDeleteDialog` externamente). `PaymentWithIncomeDeleteDialog` extraído para arquivo próprio.

---

## Pendentes

### [ ] Gráfico "Evolução do saldo" nunca renderiza na prática

**Observação:** Com 1 cobrança + 1 pagamento o gráfico exibe "Dados insuficientes para exibir o gráfico" e ocupa ~200px de espaço morto. O usuário não sabe o que falta.

**Impacto:** Médio — espaço desperdiçado, expectativa frustrada.

**Opções:**
- Revisar o threshold mínimo de dados (um gráfico de 2 pontos já é informativo)
- Tornar a mensagem mais específica: "Adicione lançamentos em datas diferentes para ver a evolução."
- Reduzir a altura do container no estado vazio para não desperdiçar tanta área

---

### [x] Campo "Mês de referência" renderiza em inglês

**Observação:** O `<input type="month">` renderiza conforme o locale do browser — comportamento esperado e consistente com o resto do app. Usuários com OS/browser em inglês verão em inglês; em português, verão em português. Não é inconsistência do app.

**Decisão:** manter `<Input type="month">` sem substituição.

---

### [ ] Sem feedback quando "Excluir" não está disponível na lista

**Observação:** Pessoas com lançamentos não têm "Excluir" no `RowActions` da lista principal — só "Visualizar" e "Editar". O usuário não entende por quê.

**Impacto:** Baixo — fluxo funciona, mas gera confusão.

**Opções:**
- Item "Excluir" desabilitado com tooltip: "Pessoa tem lançamentos — arquive em vez de excluir."
- Substituir por "Arquivar" quando há histórico (expõe o fluxo de arquivamento, resolve também o issue abaixo)

---

### [ ] Arquivamento sem caminho na UI

**Observação:** `archivePerson` existe no backend mas não está exposto na interface. Usuário que quer "remover" uma pessoa quitada não tem caminho.

**Impacto:** Baixo — sem urgência para v1, mas deixa um dead-end no fluxo.

**Solução sugerida:** Adicionar "Arquivar" no `RowActions` da lista (e/ou no detalhe via "Editar pessoa"), condicionado a `balance === 0` ou como alternativa ao "Excluir" quando há histórico. Ver lógica em `deletePersonIfEmpty` / `archivePerson` nas actions.

---

### [ ] "Visualizar" no RowActions da lista é redundante com o clique no nome

**Observação:** Clicar no nome da pessoa e clicar em "Visualizar" no kebab fazem a mesma coisa. O nome já tem estilo de link (azul no hover).

**Impacto:** Baixo — não quebra nada, mas adiciona ruído no menu.

**Opção:** Remover "Visualizar" do kebab — o nome clicável é suficiente. Ou manter como acessibilidade para usuários que não percebem o link.
