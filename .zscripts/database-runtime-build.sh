#!/bin/bash

set -euo pipefail

# ============================================================
# BD del paquete de despliegue — política de protección de datos
#
# - NO copia la BD de preview (db/ del sandbox): sus datos de
#   prueba nunca deben reemplazar datos de producción.
# - El paquete lleva una BD limpia: esquema (db:push) + datos
#   iniciales deterministas (scripts/seed.ts). Sirve como
#   imagen de siembra para BD nuevas; las BD existentes en
#   producción (DATABASE_URL externa) jamás se sobreescriben.
# - Genera db/schema.sql (DDL completo) para que start.sh →
#   scripts/prod-db-init.ts aplique en producción SOLO cambios
#   aditivos (tablas/columnas nuevas), sin tocar los datos.
# ============================================================

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"
BUILD_DIR="${BUILD_DIR:?BUILD_DIR is required}"
TARGET_DB_DIR="$BUILD_DIR/db"
TARGET_DB_PATH="$TARGET_DB_DIR/custom.db"

mkdir -p "$TARGET_DB_DIR"

echo "🗄️  Creando base de datos limpia del paquete (esquema + datos iniciales)..."
(
    cd "$PROJECT_DIR"
    DATABASE_URL="file:$TARGET_DB_PATH" bun run db:push
    DATABASE_URL="file:$TARGET_DB_PATH" bun scripts/seed.ts
)

if [ ! -f "$TARGET_DB_PATH" ]; then
    echo "❌ No se generó $TARGET_DB_PATH"
    exit 1
fi

echo "🗄️  Generando db/schema.sql (DDL aditivo para producción)..."
(
    cd "$PROJECT_DIR"
    bunx prisma migrate diff \
        --from-empty \
        --to-schema-datamodel prisma/schema.prisma \
        --script > "$TARGET_DB_DIR/schema.sql"
)

if [ ! -s "$TARGET_DB_DIR/schema.sql" ]; then
    echo "❌ La generación de schema.sql produjo un archivo vacío"
    exit 1
fi

# Bootstrap de BD que se ejecuta en el arranque (ver start.sh)
echo "🗄️  Copiando scripts/prod-db-init.ts al paquete..."
mkdir -p "$BUILD_DIR/scripts"
cp "$PROJECT_DIR/scripts/prod-db-init.ts" "$BUILD_DIR/scripts/prod-db-init.ts"

echo "✅ Base de datos del paquete lista"
ls -lah "$TARGET_DB_DIR"
