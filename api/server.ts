import express from "express";
import dotenv from "dotenv";
import { pantoneData, PantoneColor } from "../src/pantoneData";
import { hexToRgb, rgbToHsb, calculateDistance, RGB } from "../src/colorUtils";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.get("/api/pantone-match", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  const { hex, r, g, b } = req.query as {
    hex?: string;
    r?: string;
    g?: string;
    b?: string;
  };

  let baseColor: RGB | null = null;

  try {
    if (hex) {
      const normalizedHex = hex.startsWith("#") ? hex : `#${hex}`;
      const rgb = hexToRgb(normalizedHex);
      if (!rgb) {
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
  } catch (err) {
    return res.status(400).json({ error: "Failed to parse input color" });
  }

  const baseHsb = rgbToHsb(baseColor.r, baseColor.g, baseColor.b);

  const scored = pantoneData.map((color) => {
    const targetRgb = hexToRgb(color.hex)!;
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

  res.json(response);
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Pantone API server running on http://localhost:${port}`);
});

