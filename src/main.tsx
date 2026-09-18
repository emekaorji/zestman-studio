import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { installDevHandle } from "./app/devHandle";
import "./styles/globals.css";

if (import.meta.env.DEV) {
  installDevHandle();
}

// The studio is only ever served from the web, so it caches its own shell:
// after one visit it opens with no internet and still reaches the local daemon.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* a browser with service workers off still works, just not offline */
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
