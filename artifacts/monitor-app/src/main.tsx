import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Set API base URL for production
// In development, Vite proxy handles this via vite.config.ts
if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

createRoot(document.getElementById("root")!).render(<App />);
