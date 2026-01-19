import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const app = express();
const port = process.env.PORT || 3000;

// IMPORTANTE: NO hardcodees tu DB URL en el repo público.
// En Render poné DATABASE_URL como env var.
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Falta DATABASE_URL en variables de entorno.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render Postgres externo suele requerir SSL
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// Servir archivos estáticos del panel
app.use("/public", express.static(path.join(__dirname, "public")));

// Panel sin protección (como pediste)
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Healthcheck
app.get("/", (req, res) => res.send("OK"));

// Endpoint original opcional (por si lo querés mantener)
app.get("/playlist.m3u", (req, res) => {
  const filePath = path.join(__dirname, "playlist.m3u");
  if (!fs.existsSync(filePath)) return res.status(404).send("playlist.m3u no encontrado");

  const content = fs.readFileSync(filePath, "utf8");
  res.status(200);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"');
  res.setHeader("Cache-Control", "no-store");
  return res.send(content);
});

// ✅ Lo que querés: /usuario/password.m3u
app.get("/:user/:pass.m3u", async (req, res) => {
  const { user, pass } = req.params;

  try {
    const q = await pool.query(
      "SELECT 1 FROM m3u_users WHERE username = $1 AND password = $2 LIMIT 1",
      [user, pass]
    );

    if (q.rowCount === 0) {
      return res.status(403).send("Credenciales inválidas");
    }

    const filePath = path.join(__dirname, "playlist.m3u");
    if (!fs.existsSync(filePath)) return res.status(404).send("playlist.m3u no encontrado");

    const content = fs.readFileSync(filePath, "utf8");

    // Podés poner attachment o inline. Attachment descarga directo.
    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"');
    res.setHeader("Cache-Control", "no-store");
    return res.send(content);

  } catch (err) {
    console.error("DB error:", err);
    return res.status(500).send("Error interno");
  }
});

// ---------- API ADMIN (sin protección) ----------

// Listar usuarios (sin mostrar password)
app.get("/api/users", async (req, res) => {
  try {
    const q = await pool.query(
      "SELECT username, created_at FROM m3u_users ORDER BY created_at DESC"
    );
    res.json({ ok: true, users: q.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "db_error" });
  }
});

// Crear/actualizar usuario
app.post("/api/users", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  try {
    await pool.query(
      `INSERT INTO m3u_users (username, password)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password`,
      [username, password]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "db_error" });
  }
});

// Borrar usuario
app.delete("/api/users/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const q = await pool.query("DELETE FROM m3u_users WHERE username = $1", [username]);
    res.json({ ok: true, deleted: q.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "db_error" });
  }
});

app.listen(port, () => {
  console.log(`M3U server corriendo en puerto ${port}`);
});
