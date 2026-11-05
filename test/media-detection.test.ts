import assert from "node:assert/strict";
import { test } from "node:test";
import { detectMedia } from "../src/lib/services/media.service";

test("detectMedia mapeia cada tipo de mídia", () => {
  assert.equal(detectMedia({ imageMessage: { caption: "bolo" } })?.fallbackText, "bolo");
  assert.equal(detectMedia({ imageMessage: {} })?.fallbackText, "[Foto]");
  assert.equal(detectMedia({ imageMessage: {} })?.mediaType, "image");
  assert.equal(detectMedia({ audioMessage: { ptt: true } })?.mediaType, "audio");
  assert.equal(detectMedia({ videoMessage: {} })?.fallbackText, "[Vídeo]");
  assert.equal(detectMedia({ documentMessage: { fileName: "boleto.pdf" } })?.fallbackText, "boleto.pdf");
  assert.equal(detectMedia({ stickerMessage: {} })?.mediaType, "image");
  assert.equal(detectMedia({ conversation: "oi" }), null);
  assert.equal(detectMedia({}), null);
});
