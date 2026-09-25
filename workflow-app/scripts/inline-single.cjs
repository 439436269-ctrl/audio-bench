/* Inline built JS/CSS into a single index.html so it works from file:// with a double-click. */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", ".."); // build outDir parent = session cwd
const index = path.join(root, "index.html");
let html = fs.readFileSync(index, "utf8");

// strip previously injected markers if any
html = html.replace(/<!--\s*AI生成\s*-->\s*/g, "");
html = html.replace(/\s*<p data-aigc-mark="1"[^>]*>\s*AI生成\s*<\/p>\s*/g, "\n");

// inline module scripts
html = html.replace(
  /<script[^>]*type="module"[^>]*src="\.\/(workflow-assets\/[^"]+\.js)"[^>]*><\/script>|<script[^>]*src="\.\/(workflow-assets\/[^"]+\.js)"[^>]*type="module"[^>]*><\/script>/g,
  (_m, a1, a2) => {
    const asset = a1 || a2;
    const js = fs
      .readFileSync(path.join(root, asset), "utf8")
      .replace(/<\/script/g, "<\\/script");
    return `<script type="module">${js}</script>`;
  },
);

// inline stylesheets
html = html.replace(
  /<link[^>]*href="\.\/(workflow-assets\/[^"]+\.css)"[^>]*>/g,
  (_m, asset) => {
    const css = fs.readFileSync(path.join(root, asset), "utf8");
    return `<style>${css}</style>`;
  },
);

fs.writeFileSync(index, html, "utf8");
if (/workflow-assets\//.test(html)) {
  throw new Error("inline failed: external workflow-assets reference remains");
}
const kb = (fs.statSync(index).size / 1024).toFixed(0);
console.log(`single-file index.html: ${kb} KB`);
