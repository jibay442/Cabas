// Bundle le serveur en ESM ; les dépendances npm restent externes.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

await build({
  entryPoints: { "server/index": "src/server/index.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  sourcemap: true,
  define: { "process.env.CABAS_VERSION": JSON.stringify(version) },
  logLevel: "info",
});
