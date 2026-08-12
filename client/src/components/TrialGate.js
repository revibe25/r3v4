import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTrialStore, syncTrialStatus } from "@/hooks/useTrialStore";
import { useAuthStore } from "@/hooks/authStore";
export function TrialGate({ children }) {
    const { user } = useAuthStore();
    const { state, daysLeft, activateTrial } = useTrialStore();
    const [, navigate] = useLocation();
    useEffect(() => {
        if (!user)
            return;
        syncTrialStatus().then(async () => {
            const { state } = useTrialStore.getState();
            if (state === "not_started") {
                await activateTrial();
            }
        });
    }, [user]);
    useEffect(() => {
        if (state === "expired")
            navigate("/subscribe");
    }, [state]);
    return (_jsxs(_Fragment, { children: [state === "active" && daysLeft !== null && daysLeft <= 3 && (_jsx(TrialExpiryBanner, { daysLeft: daysLeft })), children] }));
}
function TrialExpiryBanner({ daysLeft }) {
    const [, navigate] = useLocation();
    const label = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
    return (_jsxs("div", { role: "alert", style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "var(--color-warning, #f59e0b)",
            color: "#000",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            fontSize: "0.875rem",
            fontWeight: 600,
        }, children: [_jsxs("span", { children: ["Trial expires ", label, ". Subscribe to keep full access."] }), _jsx("button", { onClick: () => navigate("/subscribe"), style: {
                    background: "#000",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 12px",
                    cursor: "pointer",
                    fontWeight: 700,
                }, children: "Subscribe" })] }));
}
