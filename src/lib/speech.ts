// Transcrição de áudio via Gemini inline (a mesma chave que o tenant usa para
// o LLM). Fallback global: GEMINI_TRANSCRIBE_KEY. Sem chave → null e o bot vê
// o placeholder [Áudio].
export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_TRANSCRIBE_KEY || "";
  if (!apiKey || !buffer.length) return null;

  // inline_data tem teto de request; áudio do WhatsApp fica bem abaixo disso.
  if (buffer.length > 20 * 1024 * 1024) return null;

  const model = "gemini-2.0-flash";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: "Transcreva o áudio em português do Brasil. Responda somente com a transcrição, sem comentários." },
                { inline_data: { mime_type: mimetype.split(";")[0], data: buffer.toString("base64") } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error("[speech] Gemini transcription recusou:", await response.text().catch(() => ""));
      return null;
    }
    const body = (await response.json()) as { contents?: Array<{ parts?: Array<{ text?: string }> }> };
    const text = body.contents?.[0]?.parts?.map((p) => p.text).find(Boolean);
    return text ? text.trim() : null;
  } catch (err) {
    console.error("[speech] transcribeAudio falhou:", err);
    return null;
  }
}
