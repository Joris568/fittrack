import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { ChatImageKind, ChatMessage } from "../api/types.js";
import { Button, Input, PageTitle, Spinner } from "../components/ui.js";
import { resizeImageToDataUrl } from "../lib/image.js";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000; // building a full program can chain many tool calls
const MAX_IMAGES = 4;

const isErrorReply = (content: string) => content.startsWith("Er ging iets mis") || content.startsWith("Sorry, mijn antwoord");

const KIND_LABEL: Record<ChatImageKind, string> = { screenshot: "Screenshot", progress: "Voortgangsfoto" };

export default function Coach() {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [kind, setKind] = useState<ChatImageKind>("screenshot");
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

  async function addFiles(files: File[]) {
    setPhotoError(null);
    const room = MAX_IMAGES - pending.length;
    if (room <= 0) {
      setPhotoError(`Maximaal ${MAX_IMAGES} afbeeldingen per bericht.`);
      return;
    }
    try {
      const urls = await Promise.all(files.slice(0, room).map((f) => resizeImageToDataUrl(f)));
      setPending((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
      if (files.length > room) setPhotoError(`Maximaal ${MAX_IMAGES} afbeeldingen per bericht.`);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Afbeelding laden mislukt");
    }
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) addFiles(files);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length === 0) return; // no image on the clipboard — let normal text paste happen
    e.preventDefault();
    addFiles(files);
  }

  async function retry() {
    setPhotoError(null);
    try {
      await api.post("/ai/chat/retry");
      setMessages(await api.get<ChatMessage[]>("/ai/chat"));
      pollUntilReplied();
    } catch {
      setPhotoError("Opnieuw proberen lukt nu niet. Check je verbinding.");
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const typed = input.trim();
    if (!typed && pending.length === 0) return;
    const images = pending;
    const imageKind = kind;
    const message =
      typed ||
      (imageKind === "progress"
        ? "Dit zijn mijn nieuwe voortgangsfoto's — kijk ernaar en geef gericht advies voor mijn bouw."
        : "Kijk naar deze screenshot en geef feedback.");

    setInput("");
    setPending([]);
    setPhotoError(null);
    setMessages((prev) => [
      ...(prev ?? []),
      {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
        ...(images.length ? { images, imageCount: images.length, imageKind } : {}),
      },
    ]);
    try {
      await api.post("/ai/chat", { message, ...(images.length ? { images, imageKind } : {}) });
    } catch (err) {
      // Even if the request fails to confirm, the message may still have saved — polling
      // will pick up a reply if the server actually processed it. Surface hard rejections.
      if (err instanceof Error && /groot|large|413/i.test(err.message)) {
        setPhotoError("Een afbeelding is te groot. Probeer een kleinere of minder afbeeldingen.");
      }
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
                m.role === "user" ? "bg-gray-900 text-white" : "bg-surface border border-gray-100 shadow-sm text-gray-800"
              }`}
            >
              {m.imageKind && (m.imageCount ?? 0) > 0 && (
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{KIND_LABEL[m.imageKind]}</p>
              )}
              {m.images && m.images.length > 0 ? (
                <div className={`grid gap-1 mb-2 ${m.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {m.images.map((src, i) => (
                    <img key={i} src={src} alt={KIND_LABEL[m.imageKind ?? "screenshot"]} className="rounded-lg max-h-48 w-full object-cover" />
                  ))}
                </div>
              ) : (
                (m.imageCount ?? 0) > 0 && (
                  <p className="text-xs text-gray-400 mb-1.5">{m.imageCount} afbeelding(en) meegestuurd</p>
                )
              )}
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface border border-gray-100 shadow-sm rounded-2xl px-3.5 py-2.5 text-sm text-gray-400">
              Aan het denken... (dit blijft doorgaan ook als je even wegnavigeert)
            </div>
          </div>
        )}
        {!sending && messages.length > 0 && (messages[messages.length - 1].role === "user" || isErrorReply(messages[messages.length - 1].content)) && (
          <div className="flex justify-start">
            <Button variant="secondary" className="!py-1.5 text-xs" onClick={retry}>
              Opnieuw proberen
            </Button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-surface p-2.5 mb-2 space-y-2">
          <div className="flex gap-2 overflow-x-auto pt-2 px-1">
            {pending.map((src, i) => (
              <div key={i} className="relative shrink-0">
                <img src={src} alt="Bijlage" className="w-14 h-14 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] leading-none"
                  aria-label="Verwijder bijlage"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["screenshot", "progress"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg py-2 text-xs font-semibold border ${
                  kind === k ? "bg-gray-900 text-white border-gray-900" : "bg-bg-raised text-gray-600 border-gray-200"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">
            {kind === "screenshot"
              ? "De coach bekijkt dit in het gesprek (bv. een trainingslog of etiket). Het wordt niet bij je voortgangsfoto's bewaard."
              : "Wordt bewaard bij je voortgangsfoto's en de coach beoordeelt je bouw."}
          </p>
        </div>
      )}
      {photoError && <p className="text-red-500 text-xs pb-1">{photoError}</p>}
      <form onSubmit={send} className="flex gap-2 pt-1">
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-surface border border-gray-200 text-gray-600 disabled:opacity-40"
          aria-label="Afbeelding toevoegen"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="m20 16-4.5-4.5L8 19" />
          </svg>
        </button>
        <Input
          placeholder={pending.length ? "Vraag erbij (optioneel)" : "Vraag iets aan je coach..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || (!input.trim() && pending.length === 0)}>
          Stuur
        </Button>
      </form>
    </div>
  );
}
