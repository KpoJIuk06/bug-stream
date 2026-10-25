// Build: dist/bug-stream.js — a single file without external dependencies, included by sites via <script>.
// If ../server/frontend exists, a copy is placed into server/frontend/public/widget/ —
// the server serves it at https://<subdomain>/widget/bug-stream.js.
import * as esbuild from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

await esbuild.build({
  entryPoints: { "bug-stream": "src/index.ts" },
  outdir: "dist",
  bundle: true,
  minify: true,
  sourcemap: "external",
  format: "iife",
  target: ["chrome110", "edge110", "firefox115", "safari16"],
  charset: "utf8",
  legalComments: "none",
  banner: { js: "/*! Bug Stream widget | Apache-2.0 */" },
  logLevel: "info",
});

// checksum — to verify that the server hosts the same file that passed review
const sha = createHash("sha384").update(readFileSync("dist/bug-stream.js")).digest("base64");
writeFileSync("dist/bug-stream.js.sha384", `sha384-${sha}\n`);
console.log(`integrity: sha384-${sha}`);

const site = "../server/frontend/public/widget";
if (existsSync("../server/frontend")) {
  mkdirSync(site, { recursive: true });
  copyFileSync("dist/bug-stream.js", `${site}/bug-stream.js`);
  console.log(`copied → ${site}/bug-stream.js`);
}
