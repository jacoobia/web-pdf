import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ["mupdf"] },
  build: { target: "esnext" },
  worker: { format: "es" },
});
