"use client";
import { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";

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
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="w-72 rounded-lg border bg-background p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Send feedback</span>
            <button onClick={() => setOpen(false)} aria-label="Close feedback">
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full resize-none rounded-md border p-2 text-sm h-24"
          />
          <button
            onClick={submit}
            disabled={status === "sending"}
            className="mt-2 w-full rounded-md bg-primary text-primary-foreground py-1.5 text-sm disabled:opacity-50"
          >
            {status === "sent" ? "Sent ✓" : status === "sending" ? "Sending..." : "Send"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Give feedback"
          className="rounded-full bg-primary text-primary-foreground p-3 shadow-lg hover:opacity-90"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}