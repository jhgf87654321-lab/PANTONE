import { pantoneData } from "../src/pantoneData";
import { hexToRgb, rgbToHsb, calculateDistance, type RGB } from "../src/colorUtils";

export default async function handler(
  req: { method?: string; query?: Record<string, string | string[] | undefined> },
  res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (o: unknown) => void; end: () => void }; json: (o: unknown) => void }
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q =
    req.query ||
    (typeof (req as { url?: string }).url === "string"
      ? Object.fromEntries(new URL((req as { url: string }).url, "http://localhost").searchParams)
      : {});
  const hex = typeof q.hex === "string" ? q.hex : Array.isArray(q.hex) ? q.hex[0] : undefined;
  const r = typeof q.r === "string" ? q.r : Array.isArray(q.r) ? q.r[0] : undefined;
  const g = typeof q.g === "string" ? q.g : Array.isArray(q.g) ? q.g[0] : undefined;
  const b = typeof q.b === "string" ? q.b : Array.isArray(q.b) ? q.b[0] : undefined;

  let baseColor: RGB | null = null;

  try {
    if (hex) {
      const normalizedHex = hex.trim();
      const withHash = normalizedHex.startsWith("#") ? normalizedHex : `#${normalizedHex}`;
      const rgb = hexToRgb(withHash);
      if (!/^#?[a-f\d]{6}$/i.test(withHash)) {
        return res.status(400).json({ error: "Invalid hex color" });
      }
      baseColor = rgb;
    } else if (r !== undefined && g !== undefined && b !== undefined) {
      const rNum = Number(r);
      const gNum = Number(g);
      const bNum = Number(b);

      if (
        Number.isNaN(rNum) ||
        Number.isNaN(gNum) ||
        Number.isNaN(bNum) ||
        rNum < 0 ||
        rNum > 255 ||
        gNum < 0 ||
        gNum > 255 ||
        bNum < 0 ||
        bNum > 255
      ) {
        return res.status(400).json({ error: "Invalid RGB values" });
      }

      baseColor = { r: rNum, g: gNum, b: bNum };
    } else {
      return res.status(400).json({
        error: "Missing color. Provide either ?hex=RRGGBB or ?r=..&g=..&b=..",
      });
    }
  } catch {
    return res.status(400).json({ error: "Failed to parse input color" });
  }

  const baseHsb = rgbToHsb(baseColor.r, baseColor.g, baseColor.b);

  const scored = pantoneData.map((color) => {
    const targetRgb = hexToRgb(color.hex);
    const distance = calculateDistance(baseColor!, targetRgb);

    const targetHsb = rgbToHsb(targetRgb.r, targetRgb.g, targetRgb.b);
    const hDiff = Math.abs(baseHsb.h - targetHsb.h);
    const sDiff = Math.abs(baseHsb.s - targetHsb.s);
    const bDiff = Math.abs(baseHsb.b - targetHsb.b);
    const hsbDist = Math.sqrt(hDiff * hDiff + sDiff * sDiff + bDiff * bDiff);

    return { color, distance, hsbDist };
  });

  scored.sort((a, b) => a.distance - b.distance);

  const best = scored[0];

  const response = {
    input: {
      rgb: baseColor,
      hsb: baseHsb,
    },
    pantone: {
      code: best.color.code,
      name: best.color.name,
      category: best.color.category,
      hex: best.color.hex,
      rgb: best.color.rgb,
    },
    metrics: {
      distance: best.distance,
      hsbDistance: best.hsbDist,
    },
  };

  return res.status(200).json(response);
}
