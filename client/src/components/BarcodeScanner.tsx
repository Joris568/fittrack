import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "./ui.js";

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | undefined;
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result, err) => {
          if (cancelled) return;
          if (result) {
            controls?.stop();
            onDetected(result.getText());
          }
          // NotFoundException fires continuously while no barcode is in frame — expected, ignore it.
        }
      )
      .then((c) => {
        controls = c;
      })
      .catch(() => {
        if (!cancelled) setError("Kon de camera niet openen. Geef camera-toegang in je browserinstellingen.");
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="flex justify-between items-center px-4 py-3">
        <p className="text-white font-medium">Scan barcode</p>
        <Button variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={onClose}>
          Sluiten
        </Button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-40 border-2 border-white/80 rounded-xl" />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm text-center px-6 py-4">{error}</p>}
      <p className="text-white/60 text-xs text-center px-6 pb-6">Richt de camera op de streepjescode van het product.</p>
    </div>
  );
}
