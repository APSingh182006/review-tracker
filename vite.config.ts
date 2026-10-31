import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    tailwindcss(),
    viteReact(),
  ],
  resolve: { tsconfigPaths: true },
});