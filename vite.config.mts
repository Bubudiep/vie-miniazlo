import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default () => {
  return defineConfig({
    root: ".",
    plugins: [react()],
    server: {
      allowedHosts: ["h2.chamcongchua.com"],
      proxy: {
        "/api/public/pb": {
          target: "http://127.0.0.1:8390",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/public\/pb/, ""),
        },
      },
    },
    build: {
      assetsInlineLimit: 0,
    },
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  });
};
