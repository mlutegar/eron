/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
    // Os testes do painel usam SEMPRE a camada mock: nunca falam com uma API real,
    // mesmo que exista um .env.local apontando para o backend local.
    env: { VITE_API_URL: "", VITE_API_TOKEN: "" },
  },
});
