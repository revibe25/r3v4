import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation } from "wouter";
export default function SubscribePage() {
    const [, navigate] = useLocation();
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "24px",
            color: "#fff",
            background: "#080808",
            padding: "40px",
            textAlign: "center",
        }, children: [_jsx("h1", { style: { fontSize: "2rem", fontWeight: 700, margin: 0 }, children: "Your free trial has ended" }), _jsx("p", { style: { color: "#888", maxWidth: 440, margin: 0 }, children: "Subscribe to R3 to keep full access to the DAW, loop station, AI mix engine, and all studio tools." }), _jsx("button", { onClick: () => navigate("/pricing"), style: {
                    background: "#fff",
                    color: "#000",
                    border: "none",
                    borderRadius: "6px",
                    padding: "12px 32px",
                    fontSize: "1rem",
                    fontWeight: 700,
                    cursor: "pointer",
                }, children: "View Plans" })] }));
}
