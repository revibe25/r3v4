import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SubscriptionProvider } from './hooks/useSubscription'; // added by r3-subscription installer

createRoot(document.getElementById("root")!).render(<SubscriptionProvider><App /></SubscriptionProvider>);

