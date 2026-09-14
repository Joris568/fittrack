import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { ChatMessage } from "../api/types.js";
import { Button, Input, PageTitle, Spinner } from "../components/ui.js";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000; // building a full program can chain many tool calls

export default function Coach() {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
    setSending(false);
  }

  // Polls the (server-persisted) history until a fresh assistant reply shows up —
  // works even if this component unmounted and remounted in between, since the
  // coach keeps working server-side regardless of whether anyone's looking.
  function pollUntilReplied() {
    setSending(true);
    const startedAt = Date.now();
    pollTimer.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopPolling();
        return;
      }
      try {
        const history = await api.get<ChatMessage[]>("/ai/chat");
        const last = history[history.length - 1];
        if (last && last.role === "assistant") {
          setMessages(history);
          stopPolling();
        }
      } catch {
        // Transient network hiccup — keep polling, the interval will retry.
      }
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    (async () => {
      const history = await api.get<ChatMessage[]>("/ai/chat");
      setMessages(history);
      const last = history[history.length - 1];
      if (last && last.role === "user") {
        // A reply was still pending from before (e.g. we navigated away mid-answer).
        pollUntilReplied();
        return;
      }
      try {
        const checkin = await api.post<ChatMessage | null>("/ai/chat/checkin");
        if (checkin) setMessages((prev) => [...(prev ?? []), checkin]);
      } catch {
        // Proactive check-in is a nice-to-have — silently skip if it fails.
      }
    })();
    return () => stopPolling();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    setInput("");
    setMessages((prev) => [
      ...(prev ?? []),
      { id: `tmp-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() },
    ]);
    try {
      await api.post("/ai/chat", { message });
    } catch {
      // Even if the initial request fails to confirm, the message may still have saved —
      // polling will pick up a reply if the server actually processed it.
    }
    pollUntilReplied();
  }

  if (!messages) return <Spinner />;

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <PageTitle>Coach</PageTitle>
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            Stel een vraag over je training of voeding — de coach kent je volledige geschiedenis.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
                m.role === "user" ? "bg-brand-500 text-bg font-medium" : "bg-surface shadow-sm text-gray-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface shadow-sm rounded-2xl px-3.5 py-2.5 text-sm text-gray-400">
              Aan het denken... (dit blijft doorgaan ook als je even wegnavigeert)
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 pt-2">
        <Input
          placeholder="Vraag iets aan je coach..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          Stuur
        </Button>
      </form>
    </div>
  );
}
