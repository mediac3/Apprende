# Seguridad de la API — Apprende

Estado: **Fase 1 implementada** (sesión de API + default-deny). Batch: `fix(seguridad-api)`.

## Modelo de sesión

- Al hacer login (`POST /api/auth/login`) el servidor emite una **cookie httpOnly** `apprende_session` firmada con **HMAC-SHA256** (sin dependencias nuevas; Web Crypto, compatible con middleware edge). Payload: `{ uid, iat, exp }`, TTL 7 días.
- `src/middleware.ts` aplica **default-deny a `/api/*`**: sin cookie válida ⇒ `401 {"ok":false,"error":"unauthorized"}`.
  - **Allowlist pública**: `/api/auth/login`, `/api/auth/logout`, `/api/auth/change-password` (se autoprotege exigiendo la contraseña actual).
- `logout` (cliente + `POST /api/auth/logout`) elimina la cookie y resetea módulo activo y permisos en caché.
- **«Ver como» (impersonación)**: al iniciar, la cookie pasa a identificar al usuario objetivo con TTL de 30 min (alineado a la salvaguarda); al finalizar vuelve a identificar al administrador.
- Secreto: `AUTH_SECRET` en `.env` (no versionado). Rótalo para invalidar todas las sesiones. Tras HTTPS define `COOKIE_SECURE=true`.

## Autorización por módulo (identidad real, roles frescos de BD)

`src/lib/api-guard.ts` → `requireRoles(req, roles)`: resuelve la identidad desde la cookie y los roles actuales desde la base de datos.

Rutas con guard de rol **rector/administrador**:
- `GET|POST|PATCH|DELETE /api/users` — antes respondía PII (documentos, emails, teléfonos) sin autenticación.
- `PATCH|POST /api/users/roles` (asignación individual y masiva de roles).
- `GET /api/audits` (trazabilidad).

Notas:
- `POST|PATCH|DELETE /api/users` ya chequeaban `forbiddenUnless(actorId…)`, pero el actor llegaba por body/query (falsificable); ahora la identidad viene de la sesión.
- `/api/permissions` no lleva guard extra: `mode=self` lo usa cualquier rol; la matriz ya resuelve administrador internamente.

## Deuda pendiente (fases siguientes)

1. **Param-trust en APIs de lectura**: los dashboards (`/api/student-dashboard`, `/api/teacher-dashboard`, `/api/directivo-dashboard`, `/api/parent-dashboard`, etc.) aceptan `?userId=`. Existen sesión y cookie: el paso siguiente es validar que `session.uid === userId` (o rol autorizado) dentro de cada handler. La consulta misma es parametrizada; el riesgo es lectura cruzada de datos entre usuarios autenticados.
2. **Resto de rutas de escritura** (attendance, grades, activities, students…) están tras el 401 global pero sin guard de rol: aplicar `requireRoles` según el NAV de cada módulo.
3. **Hash de contraseñas**: login usa SHA-256 plano (demo); migrar a bcrypt/scrypt/argon2 con salt.
4. **Rate limiting** en `/api/auth/login` (anti fuerza bruta) y bloqueo por intentos.
5. Rotación/refresh de sesión y revocación al desactivar un usuario (hoy la cookie vive 7 días; `requireRoles` sí exige `active: true`).
