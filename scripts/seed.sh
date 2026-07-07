#!/usr/bin/env bash
# Setup completo: claves + base de datos (cero configuración manual)
# Uso: ./scripts/seed.sh   o   npm run seed
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT/scripts/seed-env.sh"
"$ROOT/scripts/seed-db.sh"

printf '\033[32m%s\033[0m\n' "✅ Seed RK completo — listo para build/deploy"
