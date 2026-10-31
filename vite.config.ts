import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Nothing may be sent anywhere: the only network access is the app's own files.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// Vite's dev server needs inline scripts for React refresh and a socket for reloading.
const DEV = CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace(
  "connect-src 'self'",
  "connect-src 'self' ws: wss:",
);

const csp = (): Plugin => ({
  name: "csp",
  transformIndexHtml: (_, ctx) => [
    {
      tag: "meta",
      attrs: { "http-equiv": "Content-Security-Policy", content: ctx.server ? DEV : CSP },
      injectTo: "head-prepend",
    },
  ],
});

export default defineConfig({
  plugins: [react(), csp()],
  optimizeDeps: { exclude: ["mupdf"] },
  build: { target: "esnext" },
  worker: { format: "es" },
});
