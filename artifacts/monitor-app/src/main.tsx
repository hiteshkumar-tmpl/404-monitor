import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Keep relative /api calls in development so Vite proxy handles
// requests and browser cookies stay same-origin.
if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

createRoot(document.getElementById("root")!).render(<App />);
