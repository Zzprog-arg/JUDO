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

  res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="playlist.m3u"');

  res.sendFile(filePath);
});

// Opcional: healthcheck
app.get("/", (req, res) => res.send("OK"));

app.listen(port, () => {
  console.log(`M3U server corriendo en puerto ${port}`);
});
