const fs = require("fs");
const path = require("path");

const key = process.env.TMDB_API_KEY || "PON_AQUI_TU_API_KEY";
const files = ["index.html", "styles.css", "app.js"];
const dist = "dist";

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

files.forEach((f) => fs.copyFileSync(f, path.join(dist, f)));

const config = `const CONFIG = {
  API_KEY: "${key}",
  API_URL: "https://api.themoviedb.org/3",
  IMAGE_BASE: "https://image.tmdb.org/t/p/w500",
  BACKDROP_BASE: "https://image.tmdb.org/t/p/w1280",
};
`;
fs.writeFileSync(path.join(dist, "config.js"), config);

console.log("Build completado. API key:", key === "PON_AQUI_TU_API_KEY" ? "pendiente (placeholder)" : "definida");