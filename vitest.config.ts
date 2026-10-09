import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // Tests never talk to the real Supabase: these placeholders only let the modules load.
    env: { SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SECRET_KEY: "test-service-key", BACKGROUND_JOBS: "off", WHATSAPP_PROVIDER: "off" },
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "client/**/*.test.ts", "client/**/*.spec.ts"],
  },
});
