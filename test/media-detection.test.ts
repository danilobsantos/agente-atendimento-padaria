import assert from "node:assert/strict";
import { test } from "node:test";
import { detectMedia } from "../src/lib/services/media.service";
import { parseContactMessage } from "../src/lib/utils/whatsapp";

test("detectMedia mapeia cada tipo de mídia", () => {
  assert.equal(detectMedia({ imageMessage: { caption: "bolo" } })?.fallbackText, "bolo");
  assert.equal(detectMedia({ imageMessage: {} })?.fallbackText, "[Foto]");
  assert.equal(detectMedia({ imageMessage: {} })?.mediaType, "image");
  assert.equal(detectMedia({ audioMessage: { ptt: true } })?.mediaType, "audio");
  assert.equal(detectMedia({ videoMessage: {} })?.fallbackText, "[Vídeo]");
  assert.equal(detectMedia({ ptvMessage: {} })?.mediaType, "video");
  assert.equal(detectMedia({ ptvMessage: { caption: "olha isso" } })?.fallbackText, "olha isso");
  assert.equal(detectMedia({ documentMessage: { fileName: "boleto.pdf" } })?.fallbackText, "boleto.pdf");
  assert.equal(detectMedia({ stickerMessage: {} })?.mediaType, "image");
  assert.equal(detectMedia({ conversation: "oi" }), null);
  assert.equal(detectMedia({}), null);
});

test("parseContactMessage extrai nome e telefone de contactMessage e contactsArrayMessage", () => {
  const singleContact = {
    contactMessage: {
      displayName: "Danilo Santos",
      vcard: "BEGIN:VCARD\nVERSION:3.0\nN:Santos;Danilo;;;\nFN:Danilo Santos\nitem1.TEL;waid=5535988160553:+55 35 98816-0553\nEND:VCARD",
    },
  };
  const parsedSingle = parseContactMessage(singleContact);
  assert.equal(parsedSingle.length, 1);
  assert.equal(parsedSingle[0].name, "Danilo Santos");
  assert.equal(parsedSingle[0].phone, "5535988160553");

  const multipleContacts = {
    contactsArrayMessage: {
      displayName: "2 contatos",
      contacts: [
        {
          displayName: "Maria Silva",
          vcard: "BEGIN:VCARD\nVERSION:3.0\nFN:Maria Silva\nTEL;type=CELL:+55 11 99999-8888\nEND:VCARD",
        },
        {
          displayName: "João Souza",
          vcard: "BEGIN:VCARD\nVERSION:3.0\nFN:João Souza\nTEL;waid=5531988887777:+55 31 98888-7777\nEND:VCARD",
        },
      ],
    },
  };
  const parsedMultiple = parseContactMessage(multipleContacts);
  assert.equal(parsedMultiple.length, 2);
  assert.equal(parsedMultiple[0].name, "Maria Silva");
  assert.equal(parsedMultiple[0].phone, "+55 11 99999-8888");
  assert.equal(parsedMultiple[1].name, "João Souza");
  assert.equal(parsedMultiple[1].phone, "5531988887777");
});

test("evolutionGo downloadMedia faz o parse correto de responses em data.base64", async () => {
  const { EvolutionGoService } = await import("../src/lib/services/evolution-go");
  const service = new EvolutionGoService({
    baseUrl: "https://mock.evolution.test",
    apiKey: "test-key",
  });

  // Mock global fetch para simular resposta do Evolution Go
  const originalFetch = global.fetch;
  try {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          message: "success",
          data: {
            base64: "data:image/png;base64," + Buffer.from("fake-png-bytes").toString("base64"),
            timestamp: "2026-11-06T12:00:00Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const result = await service.downloadMedia({ imageMessage: {} });
    assert.ok(result);
    assert.equal(result.mimetype, "image/png");
    assert.equal(result.buffer.toString(), "fake-png-bytes");
  } finally {
    global.fetch = originalFetch;
  }
});
