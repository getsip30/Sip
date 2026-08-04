"use client";
import { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, SUCCESS2 } from "@/lib/theme";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function submit() {
    if (!text.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, path: window.location.pathname }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setText("");
      setTimeout(() => { setStatus("idle"); setOpen(false); }, 1500);
    } catch {
      setStatus("idle");
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 150, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" }}>
      {open ? (
        <div style={{ width: 288, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Send feedback</span>
            <button onClick={() => setOpen(false)} aria-label="Close feedback" style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 2, display: "flex" }}>
              <X size={16} />
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            rows={4}
            style={{ width: "100%", resize: "none", background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", color: TEXT, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          <button
            onClick={submit}
            disabled={status === "sending"}
            style={{ marginTop: 10, width: "100%", background: status === "sent" ? SUCCESS2 : ACCENT, color: "white", border: "none", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: status === "sending" ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: status === "sending" ? 0.7 : 1, transition: "background 0.2s" }}
          >
            {status === "sent" ? "Sent" : status === "sending" ? "Sending..." : "Send"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Give feedback"
          style={{ borderRadius: "50%", background: ACCENT, color: "white", border: "none", padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <MessageSquarePlus size={20} />
        </button>
      )}
    </div>
  );
}