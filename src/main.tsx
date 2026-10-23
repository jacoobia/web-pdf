import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./styles/theme.css";
import EditorRoute from "./routes/index";

createRoot(document.getElementById("root")!).render(<EditorRoute />);
