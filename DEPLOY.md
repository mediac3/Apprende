# Despliegue a producción

## Flujo (opción B — esquema por migraciones)

En el servidor de producción, tras cada actualización:

```bash
bash scripts/deploy.sh
```

O paso a paso:

```bash
git pull --ff-only origin main
npm ci                       # o npm install
npx prisma migrate deploy    # aplica migraciones pendientes (no destructivo, sin reset)
npm run build
# reiniciar el servicio: NODE_ENV=production bun .next/standalone/server.js
```

## Reglas de base de datos

1. **El esquema viaja por `prisma/migrations/`** (código), nunca editando la BD a mano.
2. **En el servidor SOLO `prisma migrate deploy`** (`npm run db:deploy`). Prohibido ahí:
   `db:push` (destructivo), `db:migrate` (`migrate dev`, requiere historial de desarrollo),
   `db:reset` (borra datos).
3. **No commitear `db/custom.db`** con cambios de esquema: el archivo sigue en el repo solo
   como bootstrap de datos demo para clones nuevos. Si se commitea una BD distinta a la de
   producción, un `git pull` en el servidor la sobrescribiría y se perderían datos.
4. Desarrollo local: crear cambios de esquema con `npx prisma migrate dev --name ...`
   (o migración manual + `prisma migrate resolve`, como en `20260923*`), verificar y push.
   El servidor los recibirá con `migrate deploy` en el siguiente despliegue.

## Bootstrap de un servidor/clon nuevo

```bash
npm ci
cp db/custom.db db/custom.db.local   # opcional: BD demo del repo como punto de partida
npx prisma migrate deploy            # alinea el esquema con las migraciones
npx tsx scripts/seed.ts              # opcional: datos semilla
npm run build
```

Nota: `prisma migrate deploy` sobre BD vacía crea el esquema completo sin datos.
