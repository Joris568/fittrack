import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { ChatMessage, ProgressPhoto } from "../api/types.js";
import { Button, Input, PageTitle, Spinner } from "../components/ui.js";
import { resizeImageToDataUrl } from "../lib/image.js";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000; // building a full program can chain many tool calls

/** Extends the persisted chat message with a client-only image preview, used for the
 * optimistic bubble shown right after a photo upload — the photo itself is persisted
 * as a ProgressPhoto, not as part of the chat message content. */
type DisplayMessage = ChatMessage & { imagePreview?: string };

export default function Coach() {
  const [messages, setMessages] = useState<DisplayMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function sendMessage(text: string) {
    setMessages((prev) => [
      ...(prev ?? []),
      { id: `tmp-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() },
    ]);
    try {
      await api.post("/ai/chat", { message: text });
    } catch {
      // Even if the initial request fails to confirm, the message may still have saved —
      // polling will pick up a reply if the server actually processed it.
    }
    pollUntilReplied();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    setInput("");
    await sendMessage(message);
  }

  async function uploadPhoto(file: File) {
    if (sending) return;
    setPhotoError(null);
    const caption = input.trim();
    setInput("");
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setMessages((prev) => [
        ...(prev ?? []),
        {
          id: `tmp-${Date.now()}`,
          role: "user",
          content: caption || "📷 Nieuwe voortgangsfoto",
          createdAt: new Date().toISOString(),
          imagePreview: dataUrl,
        },
      ]);
      setSending(true);
      await api.post<ProgressPhoto>("/progress-photos", { imageData: dataUrl });
      const message = caption
        ? `${caption} (ik heb er net een nieuwe voortgangsfoto bij geüpload — kijk ernaar)`
        : "Ik heb net een nieuwe voortgangsfoto geüpload — kijk ernaar en geef gericht advies voor mijn bouw.";
      try {
        await api.post("/ai/chat", { message });
      } catch {
        // Same fire-and-forget contract as the text path — polling picks up the reply.
      }
      pollUntilReplied();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Foto uploaden mislukt");
      setSending(false);
    }
  }

  function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadPhoto(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (!item) return; // no image on the clipboard — let normal text paste happen
    e.preventDefault();
    const file = item.getAsFile();
    if (file) uploadPhoto(file);
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
              {m.imagePreview && (
                <img src={m.imagePreview} alt="Voortgangsfoto" className="rounded-xl mb-2 max-h-48 object-cover" />
              )}
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
      {photoError && <p className="text-red-500 text-xs pb-1">{photoError}</p>}
      <form onSubmit={send} className="flex gap-2 pt-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelected}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-surface text-gray-400 text-lg disabled:opacity-40"
          aria-label="Foto toevoegen"
        >
          📷
        </button>
        <Input
          placeholder="Vraag iets aan je coach..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          Stuur
        </Button>
      </form>
    </div>
  );
}
