#!/usr/bin/env bash
# Bloqueia edições em arquivos sensíveis (.env.local, .env).

f=$(jq -r '.tool_input.file_path // empty')

case "$f" in
  *".env.local"|*".env")
    echo "Bloqueado: edições em $f não são permitidas. Edite manualmente se necessário."
    exit 2
    ;;
esac

exit 0
