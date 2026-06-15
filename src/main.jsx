import { createRoot } from "react-dom/client";
import { StrictMode } from "react";

import "./index.css";
import App from "./App2.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App></App>
  </StrictMode>,
);
