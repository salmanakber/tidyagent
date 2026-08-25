#!/usr/bin/env node
/**
 * Build the Webflow Designer Extension upload zip + private source-map artifact
 * required by Marketplace App Review Preflight.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const root = path.join(__dirname, "..");
const ext = path.join(root, "webflow-extension");
const src = path.join(ext, "src", "main.js");
const outBundle = path.join(ext, "bundle.js");
const outMap = path.join(ext, "bundle.js.map");

fs.mkdirSync(path.join(ext, "src"), { recursive: true });

execFileSync(
  "npx",
  [
    "--yes",
    "esbuild@0.25.0",
    src,
    "--bundle",
    "--minify",
    "--sourcemap",
    `--outfile=${outBundle}`,
    "--legal-comments=none",
  ],
  { cwd: root, stdio: "inherit" },
);

if (!fs.existsSync(outBundle) || !fs.existsSync(outMap)) {
  throw new Error("esbuild did not write bundle.js / bundle.js.map");
}

const bundleZip = path.join(root, "tidyagent-webflow-extension.zip");
const mapsZip = path.join(root, "tidyagent-webflow-extension-sourcemaps.zip");

function zipInTemp(entries, dest) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wf-ext-"));
  try {
    const names = [];
    for (const [name, filePath] of Object.entries(entries)) {
      const target = path.join(tmp, name);
      fs.copyFileSync(filePath, target);
      names.push(name);
    }
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    execFileSync("zip", ["-q", "-j", dest, ...names], { cwd: tmp, stdio: "inherit" });
    console.log("Wrote", dest, `(${fs.statSync(dest).size} bytes)`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

zipInTemp(
  {
    "index.html": path.join(ext, "index.html"),
    "webflow.json": path.join(ext, "webflow.json"),
    "bundle.js": outBundle,
  },
  bundleZip,
);

zipInTemp(
  {
    "bundle.js.map": outMap,
  },
  mapsZip,
);

console.log("Upload tidyagent-webflow-extension.zip as the Designer Extension bundle.");
console.log("Upload tidyagent-webflow-extension-sourcemaps.zip as the Source map artifact.");
console.log("Then run App Review Preflight in Designer on those same files and paste the wfpre_ receipt.");
