#!/usr/bin/env bash
# Despliegue de Apprende — opción B: el esquema de BD viaja por migraciones versionadas,
# NUNCA por el archivo db/custom.db. Ejecutar en el servidor de producción.
set -euo pipefail

echo "[1/5] git pull"
git pull --ff-only origin main

echo "[2/5] dependencias"
npm ci || npm install

echo "[3/5] migraciones (prisma migrate deploy — aplica pendientes, no destructivo)"
npx prisma migrate deploy

echo "[4/5] build"
npm run build

echo "[5/5] reinicio"
echo "Reinicia el servicio con tu gestor de procesos; comando directo:"
echo "  NODE_ENV=production bun .next/standalone/server.js"
echo "Despliegue completado."
