import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta exacta con terminación .m3u
app.get("/playlist.m3u", (req, res) => {
  const filePath = path.join(__dirname, "playlist.m3u");

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("playlist.m3u no encontrado");
  }

  const content = fs.readFileSync(filePath, "utf8");

  res.status(200);
  res.setHeader("Content-Type", "text/plain; charset=utf-8"); // evita que el navegador lo trate como video
  res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"'); // fuerza descarga
  res.setHeader("Cache-Control", "no-store");

  return res.send(content);
});


// Opcional: healthcheck
app.get("/", (req, res) => res.send("OK"));

app.listen(port, () => {
  console.log(`M3U server corriendo en puerto ${port}`);
});
