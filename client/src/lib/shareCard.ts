export interface ShareSpec {
  eyebrow: string;
  title: string;
  subtitle?: string;
  stats: { value: string; label: string }[];
  lines?: string[];
  footer?: string;
}

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Draws a 1080x1350 story-sized card (ink background, orange accent) and returns it as a PNG. */
export async function renderShareCard(spec: ShareSpec): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load("800 90px 'Bricolage Grotesque'"), document.fonts.load("500 32px 'DM Sans'")]);
  } catch {
    // fonts are cosmetic; fall back to system fonts
  }
  const display = "'Bricolage Grotesque', 'DM Sans', system-ui, sans-serif";
  const body = "'DM Sans', system-ui, sans-serif";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#161512";
  ctx.fillRect(0, 0, W, H);
  // soft orange glow in the corner
  const glow = ctx.createRadialGradient(W, 0, 40, W, 0, 760);
  glow.addColorStop(0, "rgba(229,72,26,0.55)");
  glow.addColorStop(1, "rgba(229,72,26,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = 84;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#FF7A45";
  ctx.font = `700 34px ${body}`;
  ctx.letterSpacing = "6px";
  ctx.fillText(spec.eyebrow.toUpperCase(), pad, 140);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 120px ${display}`;
  let y = 270;
  for (const line of wrap(ctx, spec.title, W - pad * 2).slice(0, 2)) {
    ctx.fillText(line, pad, y);
    y += 128;
  }
  if (spec.subtitle) {
    ctx.fillStyle = "#9A958A";
    ctx.font = `500 40px ${body}`;
    ctx.fillText(spec.subtitle, pad, y - 40);
  }

  // stat tiles, two per row
  const tileW = (W - pad * 2 - 28) / 2;
  const tileH = 230;
  let ty = Math.max(y + 10, 440);
  spec.stats.slice(0, 4).forEach((s, i) => {
    const tx = pad + (i % 2) * (tileW + 28);
    if (i > 0 && i % 2 === 0) ty += tileH + 28;
    ctx.fillStyle = "#26241F";
    roundRect(ctx, tx, ty, tileW, tileH, 36);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 96px ${display}`;
    ctx.fillText(s.value, tx + 40, ty + 126);
    ctx.fillStyle = "#9A958A";
    ctx.font = `500 34px ${body}`;
    ctx.fillText(s.label, tx + 40, ty + 184);
  });
  ty += tileH + 60;

  ctx.font = `600 42px ${body}`;
  for (const line of (spec.lines ?? []).slice(0, 4)) {
    ctx.fillStyle = "#E5481A";
    ctx.beginPath();
    ctx.arc(pad + 12, ty - 14, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F5F3EE";
    for (const l of wrap(ctx, line, W - pad * 2 - 50).slice(0, 2)) {
      ctx.fillText(l, pad + 44, ty);
      ty += 54;
    }
    ty += 14;
  }

  // wordmark with a tiny barbell
  ctx.fillStyle = "#E5481A";
  roundRect(ctx, pad, H - 126, 14, 56, 5);
  ctx.fill();
  roundRect(ctx, pad + 62, H - 126, 14, 56, 5);
  ctx.fill();
  ctx.fillStyle = "#F5F3EE";
  ctx.fillRect(pad + 14, H - 104, 48, 12);
  ctx.font = `800 46px ${display}`;
  ctx.fillText("FitTrack", pad + 100, H - 76);
  if (spec.footer) {
    ctx.fillStyle = "#9A958A";
    ctx.font = `500 32px ${body}`;
    ctx.textAlign = "right";
    ctx.fillText(spec.footer, W - pad, H - 76);
    ctx.textAlign = "left";
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Kaart maken mislukt"))), "image/png"));
}
