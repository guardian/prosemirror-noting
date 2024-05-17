import { defineConfig } from "vite";
import packageJson from "./package.json";

export default defineConfig({
  esbuild: {
    logOverride: { "this-is-undefined-in-esm": "silent" },
  },
  server: {
    port: 5000,
    hmr: {
      protocol: "wss",
      port: 5000,
      clientPort: 443,
      path: "ws/",
    },
  },
  build: {
    outDir: "dist/",
    sourcemap: true,
    lib: {
      entry: "src/js/index.js",
      formats: ["cjs", "es"],
      name: "noting",
      fileName: "noting",
    },
    rollupOptions: {
      // We do not bundle any dependencies specified by node_modules –
      // they should be bundled by the application using this module.
      external: Object.keys(packageJson.dependencies),
      output: {
        assetFileNames: "noting.[ext]",
      },
    },
  },
});
