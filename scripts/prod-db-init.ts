/**
 * prod-db-init.ts — Bootstrap NO destructivo de la base de datos de producción.
 *
 * Se ejecuta en el arranque (start.sh) ANTES de levantar el servidor Next.js,
 * con `bun` (usa bun:sqlite, sin dependencia del engine de Prisma).
 *
 * Garantías:
 *  1. ADITIVO: solo crea tablas/índices faltantes y agrega columnas nuevas
 *     (ALTER TABLE ... ADD COLUMN). NUNCA elimina tablas, columnas ni datos.
 *  2. DATOS INTACTOS: la BD de producción existente nunca se sobreescribe.
 *  3. SIEMBRA ÚNICAMENTE SI LA BD ESTÁ VACÍA: si hay una BD externa/persistente
 *     (DATABASE_URL) sin datos, se copian los datos iniciales del paquete.
 *     Una BD con datos jamás se re-siembra.
 *  4. IDEMPOTENTE: puede ejecutarse en cada arranque sin duplicar nada.
 *
 * Resolución de la BD (mismo criterio que el servidor):
 *   process.env.DATABASE_URL → .env del paquete → /app/db/custom.db (empaquetada)
 */

import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

// ---------- Utilidades ----------

function log(msg: string) {
  console.log(`[prod-db-init] ${msg}`);
}

function genId(): string {
  // id tipo cuid (26 chars) suficiente para SQLite
  return "c" + Buffer.from(crypto.getRandomValues(new Uint8Array(13))).toString("hex").slice(0, 25);
}

/** Lee DATABASE_URL desde .env del paquete si no viene en el entorno */
function resolveDatabaseUrl(appRoot: string): { url: string; fromEnvFile: boolean } {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return { url: process.env.DATABASE_URL.trim(), fromEnvFile: false };
  }
  for (const envFile of [
    resolve(appRoot, ".env"),
    resolve(appRoot, "next-service-dist", ".env"),
  ]) {
    if (!existsSync(envFile)) continue;
    const m = readFileSync(envFile, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    if (m) {
      return { url: m[1].trim().replace(/^["']|["']$/g, ""), fromEnvFile: true };
    }
  }
  return { url: `file:${resolve(appRoot, "db", "custom.db")}`, fromEnvFile: false };
}

/** Convierte una URL file: en ruta absoluta */
function fileUrlToPath(url: string, cwd: string): string {
  let p = url.trim();
  if (p.startsWith("file:")) p = p.slice(5);
  p = p.split("?")[0];
  if (!p.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(p)) p = resolve(cwd, p);
  return p;
}

/** Divide el SQL en sentencias respetando paréntesis y strings */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) {
      cur += ch;
      if (ch === "'" && sql[i + 1] === "'") { cur += "'"; i++; }
      else if (ch === "'") inStr = false;
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && depth <= 0) {
      const s = cur.trim();
      if (s) out.push(s);
      cur = "";
      continue;
    }
    cur += ch;
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

// ---------- 1. Sincronización aditiva de esquema ----------

interface ColDef { name: string; rest: string }

/** Extrae nombre de tabla y columnas de un CREATE TABLE */
function parseCreateTable(stmt: string): { table: string; cols: ColDef[] } | null {
  const m = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"\s*\(([\s\S]*)\)$/i);
  if (!m) return null;
  const table = m[1];
  // Dividir el cuerpo por comas de nivel 0 (ignora CHECK (...) y DEFAULT con comas)
  const body = m[2];
  const parts: string[] = [];
  let cur = "";
  let depth = 0;
  let inStr = false;
  for (const ch of body) {
    if (inStr) {
      cur += ch;
      if (ch === "'") inStr = false;
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  const cols: ColDef[] = [];
  for (const p of parts) {
    const cm = p.match(/^"([^"]+)"\s+([\s\S]*)$/);
    if (cm) cols.push({ name: cm[1], rest: cm[2].trim() });
    // CONSTRAINT / PRIMARY KEY de tabla / FOREIGN KEY / UNIQUE de tabla → se omiten
  }
  return { table, cols };
}

/** Genera un ADD COLUMN válido en SQLite a partir de la definición de columna */
function toAddColumn(table: string, col: ColDef): string {
  let def = col.rest;
  // SQLite no permite ADD COLUMN con PK/UNIQUE — los índices únicos se crean aparte
  def = def.replace(/\bPRIMARY\s+KEY\b/gi, "");
  def = def.replace(/\bUNIQUE\b/gi, "");
  def = def.replace(/,?\s*REFERENCES\s+"[^"]+"\s*\([^)]*\)[^,]*/gi, "");
  def = def.replace(/\s+/g, " ").trim();

  const notNull = /\bNOT\s+NULL\b/i.test(def);
  const hasDefault = /\bDEFAULT\b/i.test(def);
  if (notNull && !hasDefault) {
    // ADD COLUMN NOT NULL exige DEFAULT: valor neutro según tipo
    let dv = "''";
    if (/\bINTEGER|INT\b/i.test(def)) dv = "0";
    else if (/\bREAL|FLOAT|DOUBLE\b/i.test(def)) dv = "0.0";
    else if (/\bBOOLEAN\b/i.test(def)) dv = "false";
    else if (/\bDATETIME\b/i.test(def)) dv = "'1970-01-01 00:00:00'";
    def = def.replace(/\bNOT\s+NULL\b/i, `DEFAULT ${dv}`).replace(/\s+/g, " ");
  }
  return `ALTER TABLE "${table}" ADD COLUMN "${col.name}" ${def}`;
}

function syncSchema(db: Database, schemaSqlPath: string): void {
  // Los DDL de prisma traen comentarios "-- CreateTable" / "-- CreateIndex";
  // se eliminan línea a línea para que cada sentencia arranque en CREATE…
  const sql = readFileSync(schemaSqlPath, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = splitStatements(sql);
  let tablesCreated = 0;
  let columnsAdded = 0;
  let indexesCreated = 0;

  for (const stmt of statements) {
    const head = stmt.slice(0, 200).toUpperCase();

    if (head.startsWith("CREATE TABLE")) {
      const parsed = parseCreateTable(stmt);
      if (!parsed) { log(`⚠ No se pudo parsear CREATE TABLE: ${stmt.slice(0, 80)}…`); continue; }
      const exists = db
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?`)
        .get(parsed.table);
      if (!exists || exists.n === 0) {
        db.run(stmt.replace(/^CREATE\s+TABLE\s+/i, "CREATE TABLE IF NOT EXISTS "));
        tablesCreated++;
        log(`+ Tabla creada: ${parsed.table}`);
      } else {
        // Tabla existente → agregar solo columnas faltantes
        const present = new Set(
          db.query<{ name: string }>(`PRAGMA table_info("${parsed.table}")`).all().map((c) => c.name)
        );
        for (const col of parsed.cols) {
          if (present.has(col.name)) continue;
          try {
            db.run(toAddColumn(parsed.table, col));
            columnsAdded++;
            log(`+ Columna agregada: ${parsed.table}.${col.name}`);
          } catch (e: any) {
            log(`⚠ No se pudo agregar ${parsed.table}.${col.name}: ${e?.message || e}`);
          }
        }
      }
    } else if (head.startsWith("CREATE UNIQUE INDEX") || head.startsWith("CREATE INDEX")) {
      const withIfNotExists = stmt.replace(
        /^(CREATE\s+(?:UNIQUE\s+)?INDEX\s+)(?!IF\s+NOT\s+EXISTS)/i,
        "$1IF NOT EXISTS "
      );
      try {
        db.run(withIfNotExists);
        indexesCreated++;
      } catch (e: any) {
        log(`⚠ Índice omitido: ${e?.message || e}`);
      }
    }
    // ALTER TABLE / DROP / PRAGMA del script → ignorados (política aditiva)
  }
  log(`Esquema: ${tablesCreated} tablas nuevas, ${columnsAdded} columnas nuevas, ${indexesCreated} índices verificados`);
}

// ---------- 2. Normalización de roles (idempotente) ----------

const DEFAULT_ROLES: { code: string; name: string; sortOrder: number }[] = [
  { code: "rector", name: "Rector", sortOrder: 1 },
  { code: "coordinador", name: "Coordinador", sortOrder: 2 },
  { code: "director_grupo", name: "Director de grupo", sortOrder: 3 },
  { code: "docente", name: "Docente", sortOrder: 4 },
  { code: "orientador", name: "PSI - Docente Orientador", sortOrder: 5 },
  { code: "acudiente", name: "Contacto familiar", sortOrder: 6 },
  { code: "estudiante", name: "Estudiante", sortOrder: 7 },
  { code: "administrativo", name: "Administrador", sortOrder: 8 },
  { code: "supervisor", name: "Supervisor", sortOrder: 9 },
  { code: "auxiliar_principal", name: "Auxiliar principal", sortOrder: 10 },
  { code: "asistente_matricula", name: "Asistente de matrícula", sortOrder: 11 },
  { code: "tesoreria", name: "Tesorería", sortOrder: 12 },
  { code: "pta_docente_tutor", name: "PTA - Docente tutor", sortOrder: 13 },
  { code: "escuela_nueva", name: "Escuela nueva", sortOrder: 14 },
  { code: "tercero", name: "Tercero", sortOrder: 15 },
];

function normalizeRoles(db: Database): void {
  const hasRoleTable = db
    .query<{ n: number }>(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='Role'`)
    .get();
  if (!hasRoleTable || hasRoleTable.n === 0) {
    log("⚠ Tabla Role inexistente tras la sincronización — se omite normalización");
    return;
  }

  const institutions = db.query<{ id: string; name: string }>(`SELECT id, name FROM Institution`).all();
  for (const inst of institutions) {
    for (const r of DEFAULT_ROLES) {
      db.run(
        `INSERT OR IGNORE INTO Role (id, institutionId, code, name, description, sortOrder, active, createdAt)
         VALUES (?, ?, ?, ?, NULL, ?, 1, datetime('now'))`,
        [genId(), inst.id, r.code, r.name, r.sortOrder]
      );
    }
  }

  // Roles legacy desconocidos (User.role sin entrada en catálogo)
  db.run(
    `INSERT OR IGNORE INTO Role (id, institutionId, code, name, description, sortOrder, active, createdAt)
     SELECT 'c' || lower(hex(randomblob(25))), u.institutionId, u.role,
            substr(upper(u.role), 1, 40) || lower(substr(u.role, 2)), NULL, 90, 1, datetime('now')
     FROM User u
     WHERE u.role IS NOT NULL AND u.role != '' AND NOT EXISTS (
       SELECT 1 FROM Role r WHERE r.institutionId = u.institutionId AND r.code = u.role
     )`
  );

  // Backfill: UserRole desde User.role
  db.run(
    `INSERT INTO UserRole (id, userId, roleId)
     SELECT 'c' || lower(hex(randomblob(25))), u.id, r.id
     FROM User u
     JOIN Role r ON r.institutionId = u.institutionId AND r.code = u.role
     WHERE NOT EXISTS (SELECT 1 FROM UserRole ur WHERE ur.userId = u.id AND ur.roleId = r.id)`
  );

  // Rol principal = asignado con menor sortOrder
  db.run(
    `UPDATE User SET role = (
       SELECT r.code FROM UserRole ur JOIN Role r ON r.id = ur.roleId
       WHERE ur.userId = User.id ORDER BY r.sortOrder ASC LIMIT 1
     )
     WHERE EXISTS (SELECT 1 FROM UserRole ur WHERE ur.userId = User.id)`
  );

  const roles = db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM Role`).get();
  const urs = db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM UserRole`).get();
  log(`Roles: catálogo=${roles?.n ?? 0}, asignaciones=${urs?.n ?? 0}`);
}

// ---------- 3. Siembra solo si la BD está vacía ----------

function seedIfEmpty(db: Database, packagedDbPath: string, dbPath: string): void {
  db.run(`CREATE TABLE IF NOT EXISTS _prod_meta (key TEXT PRIMARY KEY, value TEXT)`);

  const inst = db
    .query<{ n: number }>(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='Institution'`)
    .get();
  const hasData =
    inst && inst.n > 0 &&
    (db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM Institution`).get()?.n ?? 0) > 0;

  const alreadySeeded = db
    .query<{ n: number }>(`SELECT COUNT(*) AS n FROM _prod_meta WHERE key='seeded' AND value='1'`)
    .get()?.n ?? 0;

  if (hasData) {
    db.run(`INSERT OR REPLACE INTO _prod_meta (key, value) VALUES ('seeded', '1')`);
    log("BD con datos existentes: NO se siembra (datos de producción intactos)");
    return;
  }
  if (alreadySeeded) {
    log("BD marcada como sembrada previamente: NO se siembra de nuevo");
    return;
  }
  if (!existsSync(packagedDbPath)) {
    log(`⚠ BD vacía y sin BD de datos iniciales en ${packagedDbPath} — queda vacía`);
    return;
  }
  if (resolve(packagedDbPath) === resolve(dbPath)) {
    // La BD destino ES la empaquetada (ya viene sembrada desde el build)
    db.run(`INSERT OR REPLACE INTO _prod_meta (key, value) VALUES ('seeded', '1')`);
    log("BD empaquetada en uso (datos iniciales incluidos en el build)");
    return;
  }

  log("BD vacía: copiando datos iniciales del paquete…");
  db.run(`ATTACH DATABASE ? AS pkg`, [packagedDbPath]);
  try {
    db.run(`PRAGMA defer_foreign_keys = 1`);
    db.run(`BEGIN`);
    const tables = db
      .query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prod_meta'`
      )
      .all()
      .map((t) => t.name);
    for (const t of tables) {
      const pkgHas = db
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM pkg.sqlite_master WHERE type='table' AND name=?`)
        .get(t);
      if (!pkgHas || pkgHas.n === 0) continue;
      // Columnas compartidas (por nombre) para no depender del orden físico
      const mainCols = db.query<{ name: string }>(`PRAGMA main.table_info("${t}")`).all().map((c) => c.name);
      const pkgCols = new Set(
        db.query<{ name: string }>(`PRAGMA pkg.table_info("${t}")`).all().map((c) => c.name)
      );
      const cols = mainCols.filter((c) => pkgCols.has(c));
      if (cols.length === 0) continue;
      const colList = cols.map((c) => `"${c}"`).join(", ");
      db.run(`INSERT OR IGNORE INTO main."${t}" (${colList}) SELECT ${colList} FROM pkg."${t}"`);
    }
    db.run(`COMMIT`);
    db.run(`INSERT OR REPLACE INTO _prod_meta (key, value) VALUES ('seeded', '1')`);
    const users = db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM User`).get();
    log(`Siembra completada: ${users?.n ?? 0} usuarios iniciales`);
  } catch (e: any) {
    try { db.run(`ROLLBACK`); } catch {}
    log(`✖ Error en la siembra: ${e?.message || e}`);
  } finally {
    try { db.run(`DETACH DATABASE pkg`); } catch {}
  }
}

// ---------- Main ----------

const cwd = process.cwd();
const appRoot = existsSync(resolve(cwd, "db")) ? cwd : dirname(cwd); // /app o /app/next-service-dist
const { url, fromEnvFile } = resolveDatabaseUrl(appRoot);
const dbPath = fileUrlToPath(url, appRoot);
const packagedDbPath = resolve(appRoot, "db", "custom.db");
const schemaSqlPath = resolve(appRoot, "db", "schema.sql");

log(`BD de producción: ${dbPath}${fromEnvFile ? " (desde .env)" : ""}`);

if (!existsSync(dbPath)) {
  // BD externa inexistente: si hay empaquetada se adopta como inicial (copiada, el paquete es solo lectura)
  if (existsSync(packagedDbPath) && resolve(packagedDbPath) !== resolve(dbPath)) {
    const { mkdirSync, copyFileSync } = await import("node:fs");
    mkdirSync(dirname(dbPath), { recursive: true });
    copyFileSync(packagedDbPath, dbPath);
    log(`BD externa inexistente: inicializada desde el paquete → ${dbPath}`);
  } else if (!existsSync(packagedDbPath)) {
    log(`✖ No existe ${dbPath} ni BD empaquetada — nada que inicializar`);
    process.exit(1);
  }
}

const db = new Database(dbPath);
try {
  if (existsSync(schemaSqlPath)) {
    syncSchema(db, schemaSqlPath);
  } else {
    log(`⚠ ${schemaSqlPath} no encontrado — se omite la sincronización de esquema`);
  }
  normalizeRoles(db);
  seedIfEmpty(db, packagedDbPath, dbPath);
  log("✔ Base de datos lista (operación aditiva, sin tocar datos existentes)");
} finally {
  db.close();
}
