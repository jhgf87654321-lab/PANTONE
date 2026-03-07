import express from "express";
import dotenv from "dotenv";
import { pantoneData } from "../src/pantoneData";
import { hexToRgb, rgbToHsb, calculateDistance, type RGB } from "../src/colorUtils";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json({ limit: "10mb" }));

app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.post("/api/gemini-colors", async (req, res) => {

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  const { mimeType, base64 } = req.body || {};
  if (!mimeType || !base64) {
    return res.status(400).json({ error: "Missing mimeType or base64 in request body" });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Analyze this image and extract the 5 most dominant or visually significant colors. " +
                    "Return ONLY a JSON array of objects, where each object has 'r', 'g', and 'b' integer properties " +
                    "representing the RGB values. Example format: [{\"r\":255,\"g\":0,\"b\":0},{\"r\":0,\"g\":255,\"b\":0}]. " +
                    "Do not include any other text or explanation.",
                },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: Record<string, unknown> = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        /* ignore */
      }
      const message =
        (errorData.error as { message?: string })?.message ||
        (errorData.message as string) ||
        `Gemini API request failed with status ${response.status}`;
      return res.status(response.status).json({ error: message });
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const textContent =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join(" ")
        .trim() || "";

    let colors: Array<{ r: number; g: number; b: number }> = [];
    if (textContent) {
      try {
        colors = JSON.parse(textContent);
      } catch {
        const jsonMatch = textContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            colors = JSON.parse(jsonMatch[0]);
          } catch {
            /* ignore */
          }
        }
      }
    }

    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      return res.status(500).json({ error: "Gemini did not return a valid color array" });
    }

    return res.status(200).json({ colors });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error)?.message || "Failed to call Gemini API" });
  }
});

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

