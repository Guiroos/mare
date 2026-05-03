#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
file_path=$(jq -r '.tool_input.file_path // ""' <<< "$input")

# Only .tsx/.ts files under components/ or app/
echo "$file_path" | grep -qE '\.(tsx|ts)$' || exit 0
echo "$file_path" | grep -qE '(^|/)(components|app)/' || exit 0

rel=$(echo "$file_path" | sed "s|$(pwd)/||")
echo "Componente modificado: $rel — execute o agente ds-reviewer para verificar conformidade com o DS Maré."
exit 2
