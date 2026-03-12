import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { inject } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import App from "./App";

inject();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""}>
      <App />
      <SpeedInsights />
    </GoogleOAuthProvider>
  </StrictMode>
);
