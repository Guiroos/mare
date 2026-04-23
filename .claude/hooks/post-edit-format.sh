#!/usr/bin/env bash
# Roda após Edit/Write: formata com Prettier e verifica com ESLint.
# Acorda o Claude (exit 2) se houver erros de lint.

PROJECT_DIR="/home/guiroos/Documentos/Projects/mare"

f=$(jq -r '.tool_input.file_path')

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs) ;;
  *) exit 0 ;;
esac

cd "$PROJECT_DIR"

# Prettier: auto-fixa silenciosamente
npx prettier --write "$f" 2>/dev/null

# ESLint: reporta erros
out=$(npx eslint "$f" 2>&1)
eslint_exit=$?

[ $eslint_exit -eq 0 ] && exit 0

printf 'ESLint encontrou problemas em %s:\n\n%s\n' "$f" "$out"
exit 2
