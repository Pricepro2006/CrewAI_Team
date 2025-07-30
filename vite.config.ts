import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: ".",
  publicDir: "public",
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  define: {
    global: "globalThis",
    "process.env": "{}",
    "process.env.NODE_ENV": '"development"',
    "process.cwd": '"/"',
  },
  server: {
    port: 5173,
    open: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@core": path.resolve(__dirname, "./src/core"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@ui": path.resolve(__dirname, "./src/ui"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@client": path.resolve(__dirname, "./src/client"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      // Externalize Node.js modules for browser compatibility
      fs: path.resolve(__dirname, "./src/ui/utils/empty-polyfill.js"),
      "fs/promises": path.resolve(
        __dirname,
        "./src/ui/utils/empty-polyfill.js",
      ),
      path: path.resolve(__dirname, "./src/ui/utils/empty-polyfill.js"),
      crypto: path.resolve(__dirname, "./src/ui/utils/empty-polyfill.js"),
    },
  },
  build: {
    outDir: "dist/ui",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: "./index.html",
      },
      external: ["fs", "fs/promises", "path", "crypto"],
    },
  },
});
