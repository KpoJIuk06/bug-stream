// Builds the extension into dist/: TypeScript → JS (esbuild) + static files.
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const watch = process.argv.includes("--watch");
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("static", "dist", { recursive: true });
cpSync("node_modules/rrweb-player/dist/style.css", "dist/rrweb-player.css");

// Default server address (organization subdomain): BUGSTREAM_SERVER=https://bugs.example.com npm run build
// The user can change it when signing in; an administrator can set it by policy (static/schema.json).
const defaultServer = (process.env.BUGSTREAM_SERVER ?? "http://localhost").trim().replace(/\/+$/, "");
if (!/^https?:\/\/[^/]+$/.test(defaultServer)) throw new Error(`BUGSTREAM_SERVER: expected an address like https://bugs.example.com, got "${defaultServer}"`);
console.log(`default server: ${defaultServer}`);

const options = {
  entryPoints: {
    background: "src/background.ts",
    offscreen: "src/offscreen.ts",
    popup: "src/popup.ts",
    preview: "src/preview.ts",
    "content-main": "src/content/main-world.ts",
    "content-isolated": "src/content/isolated.ts",
    "content-replay": "src/content/replay.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  charset: "utf8",
  logLevel: "info",
  define: { __DEFAULT_SERVER__: JSON.stringify(defaultServer) },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
