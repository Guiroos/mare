#!/usr/bin/env bash
# Roda após Edit/Write: formata com Prettier e verifica com ESLint.
# Acorda o Claude (exit 2) se houver erros de lint.
set -euo pipefail

input=$(cat)
f=$(jq -r '.tool_input.file_path // ""' <<< "$input")

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs) ;;
  *) exit 0 ;;
esac

# Prettier: auto-fixa silenciosamente. `|| true`: arquivo com erro de sintaxe
# faz o Prettier falhar, e sob `set -e` isso encerraria o hook antes do ESLint.
npx prettier --write "$f" 2>/dev/null || true

# ESLint: reporta erros. O `|| eslint_exit=$?` é obrigatório: sob `set -e`, uma
# atribuição `out=$(cmd)` com `cmd` falhando encerra o script com o código do
# ESLint (1, não-bloqueante e sem saída) e o `exit 2` abaixo nunca roda.
eslint_exit=0
out=$(npx eslint --max-warnings 0 "$f" 2>&1) || eslint_exit=$?

[ $eslint_exit -eq 0 ] && exit 0

printf 'ESLint encontrou problemas em %s:\n\n%s\n' "$f" "$out"
exit 2
