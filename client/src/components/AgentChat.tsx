import { useState } from "react";

export default function AgentChat() {
  const [msg, setMsg] = useState("");
  const [reply, setReply] = useState("");

  async function send() {
    const res = await fetch("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    setReply(data.reply);
  }

  return (
    <div>
      <input
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
      />
      <button onClick={send}>Send</button>
      <div>{reply}</div>
    </div>
  );
}
