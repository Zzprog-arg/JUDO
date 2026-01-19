import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const app = express();
const port = process.env.PORT || 3000;

// =====================
// CONFIG DB
// =====================
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL en Render");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =====================
// CREAR TABLA AUTOMÁTICA
// =====================
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS m3u_users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("✅ Tabla m3u_users lista");
  } catch (err) {
    console.error("❌ Error creando tabla:", err);
    process.exit(1);
  }
}

// ejecuta apenas arranca el server
await initDatabase();

// =====================
// PATHS
// =====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

// =====================
// RUTAS
// =====================

app.get("/", (req, res) => res.send("OK"));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// playlist fija
app.get("/playlist.m3u", (req, res) => {
  const filePath = path.join(__dirname, "playlist.m3u");

  if (!fs.existsSync(filePath))
    return res.status(404).send("playlist.m3u no encontrado");

  const content = fs.readFileSync(filePath, "utf8");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"');
  res.setHeader("Cache-Control", "no-store");

  res.send(content);
});

// =====================
// LINK CON USUARIO/PASS
// =====================
app.get("/:user/:pass.m3u", async (req, res) => {
  const { user, pass } = req.params;

  try {
    const q = await pool.query(
      "SELECT 1 FROM m3u_users WHERE username=$1 AND password=$2",
      [user, pass]
    );

    if (q.rowCount === 0)
      return res.status(403).send("Usuario o contraseña inválidos");

    const filePath = path.join(__dirname, "playlist.m3u");
    const content = fs.readFileSync(filePath, "utf8");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"');
    res.setHeader("Cache-Control", "no-store");

    res.send(content);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send("Error interno");
  }
});

// =====================
// API ADMIN
// =====================
app.get("/api/users", async (req, res) => {
  try {
    const q = await pool.query(
      "SELECT username, created_at FROM m3u_users ORDER BY created_at DESC"
    );
    res.json({ ok: true, users: q.rows });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.post("/api/users", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ ok: false });

  try {
    await pool.query(
      `
      INSERT INTO m3u_users (username, password)
      VALUES ($1,$2)
      ON CONFLICT (username)
      DO UPDATE SET password = EXCLUDED.password
      `,
      [username, password]
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.delete("/api/users/:username", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM m3u_users WHERE username=$1",
      [req.params.username]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// =====================
app.listen(port, () => {
  console.log("🚀 Servidor M3U activo");
});
