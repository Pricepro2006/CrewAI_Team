import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh
      fastRefresh: true,
      // Optimize JSX runtime
      jsxRuntime: "automatic",
    }),
    // Bundle analyzer - only run when ANALYZE env var is set
    process.env.ANALYZE === 'true' && visualizer({
      open: true,
      filename: './dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  root: ".",
  publicDir: "public",
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@trpc/client",
      "@trpc/react-query",
      "zustand",
      "zustand/middleware",
      "recharts",
      "chart.js",
      "react-chartjs-2",
      "date-fns",
      "lucide-react",
      "clsx",
      "tailwind-merge"
    ],
    exclude: ["fs", "fs/promises", "path", "crypto"],
    force: process.env.NODE_ENV === 'development', // Force re-optimization in dev
    esbuildOptions: {
      target: 'esnext'
    }
  },
  define: {
    global: "globalThis",
    "process.env": "{}",
    "process.env.NODE_ENV": '"development"',
    "process.cwd": '"/"',
  },
  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5173,
    open: process.env.NODE_ENV !== 'test',
    host: true,
    cors: true,
    strictPort: false, // Allow port changes if occupied
    hmr: {
      overlay: true,
      port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) + 1 : 24678, // Separate HMR port
      clientPort: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) + 1 : 24678,
    },
    watch: {
      usePolling: process.env.VITE_USE_POLLING === 'true',
      interval: 100,
      ignored: ['**/node_modules/**', '**/dist/**', '**/coverage/**']
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        timeout: 30000,
        proxyTimeout: 30000
      },
      "/trpc": {
        target: "http://localhost:3001",
        changeOrigin: true,
        timeout: 30000,
        proxyTimeout: 30000
      },
    },
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
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    target: "es2020", // Better browser support while maintaining performance
    minify: "esbuild",
    // Performance optimizations
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 300, // Lower threshold for better monitoring
    rollupOptions: {
      input: {
        main: "./index.html",
      },
      external: ["fs", "fs/promises", "path", "crypto"],
      output: {
        // Optimized code splitting to reduce bundle sizes
        manualChunks: (id) => {
          // Core React libraries (keep together for better caching)
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          
          // Chart libraries (split by usage to enable lazy loading)
          if (id.includes('recharts')) {
            return 'recharts-vendor';
          }
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'chartjs-vendor';
          }
          
          // tRPC and API libraries
          if (id.includes('@trpc') || id.includes('@tanstack/react-query')) {
            return 'api-vendor';
          }
          
          // Table libraries (loaded on demand)
          if (id.includes('@tanstack/react-table')) {
            return 'table-vendor';
          }
          
          // UI libraries (commonly used)
          if (id.includes('lucide-react') || id.includes('date-fns') || 
              id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'ui-vendor';
          }
          
          // State management
          if (id.includes('zustand')) {
            return 'state-vendor';
          }
          
          // Walmart-specific components
          if (id.includes('src/ui/components/walmart') || 
              id.includes('src/client/components/walmart')) {
            return 'walmart-features';
          }
          
          // Email dashboard components
          if (id.includes('src/ui/components/dashboard') || 
              id.includes('src/client/components/dashboard')) {
            return 'email-features';
          }
          
          // Monitoring components
          if (id.includes('src/ui/components/monitoring') || 
              id.includes('src/client/components/monitoring')) {
            return 'monitoring-features';
          }
          
          // Large third-party libraries
          if (id.includes('node_modules')) {
            // Split large libraries into separate chunks
            if (id.includes('ws') || id.includes('socket')) {
              return 'websocket-vendor';
            }
            if (id.includes('cheerio') || id.includes('jsdom')) {
              return 'parsing-vendor';
            }
            return 'vendor';
          }
          
          return undefined;
        },
        // Optimize chunk loading
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split("/").pop()?.replace(/\.\w+$/, "")
            : "chunk";
          return `assets/js/[name]-[hash].js`;
        },
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "assets/css/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    // Additional performance optimizations
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
        pure_funcs: ['console.log', 'console.info']
      },
      mangle: {
        safari10: true
      }
    }
  },
  // Performance optimizations for development
  esbuild: {
    target: "esnext",
    keepNames: true,
    minify: process.env.NODE_ENV === 'production',
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  },
  
  // Cache configuration for better performance
  cacheDir: 'node_modules/.vite',
  
  // CSS configuration
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "src/styles/variables.scss";`
      }
    }
  },
});
