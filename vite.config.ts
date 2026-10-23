import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// mupdf loads its own .wasm via import.meta.url and uses top-level await.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ["mupdf"] },
  build: { target: "esnext" },
  worker: { format: "es" }, // the render worker imports mupdf, which needs top-level await
});
