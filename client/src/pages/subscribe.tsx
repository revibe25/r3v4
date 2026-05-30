import { useLocation } from "wouter";

export default function SubscribePage() {
  const [, navigate] = useLocation();
  return (
    <div
      style={{
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
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>
        Your free trial has ended
      </h1>
      <p style={{ color: "#888", maxWidth: 440, margin: 0 }}>
        Subscribe to R3 to keep full access to the DAW, loop station,
        AI mix engine, and all studio tools.
      </p>
      <button
        onClick={() => navigate("/pricing")}
        style={{
          background: "#fff",
          color: "#000",
          border: "none",
          borderRadius: "6px",
          padding: "12px 32px",
          fontSize: "1rem",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        View Plans
      </button>
    </div>
  );
}
