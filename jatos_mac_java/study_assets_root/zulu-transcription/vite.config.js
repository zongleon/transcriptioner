import { defineConfig } from "vite";

export default defineConfig({
  base: "",
  build: {
    rollupOptions: {
      input: {
        main: "src/index.html",
        intro: "src/intro.html",
        demo: "src/demo.html",
      },
    },
  },
});
