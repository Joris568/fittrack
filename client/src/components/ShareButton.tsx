import { useState } from "react";
import { renderShareCard, type ShareSpec } from "../lib/shareCard.js";
import { Button } from "./ui.js";

/** Renders the card as an image and opens the phone's share sheet; on browsers without file
 * sharing it shows the image to long-press/save instead. */
export default function ShareButton({ spec, filename, label = "Deel als afbeelding" }: { spec: ShareSpec; filename: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    try {
      const blob = await renderShareCard(spec);
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: spec.title });
      } else {
        setPreview(URL.createObjectURL(blob));
      }
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={share} disabled={busy}>
        {busy ? "Kaart maken..." : label}
      </Button>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-gray-900/70" onClick={() => setPreview(null)} aria-label="Sluiten" />
          <div className="relative max-w-sm w-full space-y-3">
            <img src={preview} alt="Je kaart" className="w-full rounded-xl shadow-card" />
            <div className="flex gap-2">
              <a href={preview} download={filename} className="flex-1 text-center rounded-lg bg-white py-2.5 text-sm font-semibold">
                Download
              </a>
              <button className="rounded-lg bg-white/90 px-4 py-2.5 text-sm font-medium" onClick={() => setPreview(null)}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
