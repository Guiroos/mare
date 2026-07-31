# Critérios de auditoria deste projeto

Referenciado por `CLAUDE.md` via `@`. Usado pela Routine `auditoria-diaria` e por qualquer revisão de código (manual ou `/code-review`) neste repositório.

## O que é bug aqui

- Estado derivado guardado em useState em vez de calculado no render
- useEffect com dependência faltando ou com cleanup ausente
- Componente que refaz fetch em cascata (waterfall) em vez de paralelo
- any explícito ou implícito em código de domínio
- Handler de erro que engole a exceção sem log nem feedback ao usuário

## O que NÃO reportar

- Preferência de estilo já coberta pelo ESLint/Prettier
- Sugestão de trocar biblioteca ou framework
- "Adicionar testes" como issue genérica sem apontar o caso não coberto
- Otimização sem evidência de custo real
