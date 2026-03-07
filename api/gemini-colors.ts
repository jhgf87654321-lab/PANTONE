export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
        headers: {
          "Content-Type": "application/json",
        },
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
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // ignore
      }
      const message =
        errorData.error?.message ||
        errorData.message ||
        `Gemini API request failed with status ${response.status}`;
      return res.status(response.status).json({ error: message });
    }

    const data = await response.json();

    const textContent =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join(" ")
        .trim() || "";

    let colors: any[] = [];
    if (textContent) {
      try {
        colors = JSON.parse(textContent);
      } catch {
        const jsonMatch = textContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            colors = JSON.parse(jsonMatch[0]);
          } catch {
            // ignore
          }
        }
      }
    }

    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      return res.status(500).json({ error: "Gemini did not return a valid color array" });
    }

    return res.status(200).json({ colors });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to call Gemini API" });
  }
}

