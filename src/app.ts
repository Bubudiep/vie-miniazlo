// ZaUI stylesheet
import "zmp-ui/zaui.css";
// Tailwind stylesheet
import "@/css/tailwind.scss";
// Your stylesheet
import "@/css/app.scss";

// React core
import React from "react";
import { createRoot } from "react-dom/client";

// Mount the app
import Layout from "@/components/layout";

const root = createRoot(document.getElementById("app")!);
root.render(React.createElement(Layout));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Không thể đăng ký PWA service worker", error);
    });
  });
}
