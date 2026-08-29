import { defineConfig } from "vite";

// base: "./" keeps the build portable (GitHub Pages subpaths, Netlify, etc.)
export default defineConfig({
  base: "./",
  test: {
    environment: "node",
  },
});
