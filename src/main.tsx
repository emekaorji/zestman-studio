import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { installDevHandle } from "./app/devHandle";
import "./styles/globals.css";

if (import.meta.env.DEV) {
  installDevHandle();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
