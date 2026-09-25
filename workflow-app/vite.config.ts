import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/** Build into parent cwd so preview can open index.html directly. */
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: resolve(__dirname, ".."),
    emptyOutDir: false,
    assetsDir: "workflow-assets",
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
});
