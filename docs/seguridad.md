# Seguridad de la API — Apprende

Estado: **Fase 1 + Fase 2 implementadas** (sesión de API, default-deny, param-trust, guards de escritura, bcrypt, rate-limit).

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

1. ~~**Param-trust en APIs de dashboards**~~ ✅ FASE 2: `/api/student-dashboard`, `/api/teacher-dashboard`, `/api/directivo-dashboard`, `/api/parent-dashboard`, `/api/dashboard`, `/api/permissions?mode=self`, `/api/messages`, `/api/notifications` validan `userId === session.uid` (`isSelf`). Pendiente extender el mismo patrón a APIs "self" menores (p. ej. `/api/user-scope` GET ya acepta self-o-admin vía roles; revisar el resto caso a caso).
2. **Resto de rutas de escritura**: cubiertas con `requireModule` (mapa `MODULE_ROLES` en `src/lib/api-guard.ts`) las de: gestión de estudiantes (create/edit/delete/bulk/import), asistencia, notas (grades, grade-records, grade-comments), opciones de tema, umbrales del dashboard directivo, usuarios y auditoría. **Pendiente de aplicar el mismo guard** (2 líneas por handler con el mapa ya listo): activities, groups, subjects, subject-assignments, evaluative-concepts, educational-models, evaluation-scales, periods, academic-years, meetings, workshops, curriculum-*, custom-modules (admin), enrollment-events, student-contacts/requirements/certificates, spaces, report-templates/variables, feed. Riesgo hoy: quedan tras el 401 global (exigen sesión) pero un usuario autenticado cualquiera podría escribir en ellas.
3. ~~**Hash de contraseñas**~~ ✅ FASE 2: bcrypt (cost 10) en `src/lib/password.ts`; las históricas SHA-256 se aceptan y se re-hashan transparentemente en el login (upgrade verificado en BD: `$2b$…`). Semillas (scripts/seed.ts) ya siembran bcrypt.
4. ~~**Rate limiting en login**~~ ✅ FASE 2: 5 fallos por usuario+IP cada 15 min → `429` (en memoria, válido para una sola instancia; migrar a Redis/BD si se escala horizontal).
5. Rotación/refresh de sesión y revocación al desactivar un usuario (hoy la cookie vive 7 días; `requireRoles`/`requireModule` sí exigen `active: true`).
6. Next 16: convención `middleware.ts` renombrada a **`proxy.ts`** (mismo comportamiento; elimina el warning de deprecación).
