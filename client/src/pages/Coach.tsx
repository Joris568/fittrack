import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { ChatMessage } from "../api/types.js";
import { Button, Input, PageTitle, Spinner } from "../components/ui.js";

export default function Coach() {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<ChatMessage[]>("/ai/chat").then(setMessages);
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
    setSending(true);
    try {
      const res = await api.post<{ reply: string }>("/ai/chat", { message });
      setMessages((prev) => [
        ...(prev ?? []),
        { id: `tmp-r-${Date.now()}`, role: "assistant", content: res.reply, createdAt: new Date().toISOString() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...(prev ?? []),
        {
          id: `tmp-e-${Date.now()}`,
          role: "assistant",
          content: "Er ging iets mis, probeer het nog eens.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
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
                m.role === "user" ? "bg-brand-600 text-white" : "bg-white shadow-sm text-gray-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white shadow-sm rounded-2xl px-3.5 py-2.5 text-sm text-gray-400">Aan het typen...</div>
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
