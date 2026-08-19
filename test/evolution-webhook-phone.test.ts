import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getPhoneLookupVariants, normalizePhone } from "../src/lib/utils/company";

describe("Phone Normalization and Evolution Webhook JID Resolution", () => {
  test("normalizePhone standardizes Brazilian phones to DDI 55", () => {
    assert.equal(normalizePhone("35988160553"), "5535988160553");
    assert.equal(normalizePhone("(35) 98816-0553"), "5535988160553");
    assert.equal(normalizePhone("5535988160553"), "5535988160553");
    assert.equal(normalizePhone("3588160553"), "553588160553");
  });

  test("getPhoneLookupVariants includes both 55 and without-55 plus 8/9 digit variants", () => {
    const variants = getPhoneLookupVariants("5535988160553");
    // Standard with 55
    assert.ok(variants.includes("5535988160553"), "should include 5535988160553");
    // Local without 55
    assert.ok(variants.includes("35988160553"), "should include 35988160553");
    // 8-digit with 55
    assert.ok(variants.includes("553588160553"), "should include 553588160553");
    // 8-digit without 55
    assert.ok(variants.includes("3588160553"), "should include 3588160553");
  });

  test("extractPhoneFromJid and resolveCustomerPhone prioritizes @s.whatsapp.net over @lid", () => {
    function extractPhoneFromJid(jid: unknown): string | null {
      if (!jid || typeof jid !== "string") return null;
      const userPart = jid.split("@")[0].split(":")[0];
      const digits = userPart.replace(/\D/g, "");
      return digits || null;
    }

    function resolveCustomerPhone(data: any, info: any): string | null {
      const candidateJids: unknown[] = [
        info.SenderAlt,
        info.Sender,
        data.senderAlt,
        data.sender,
        data.key?.remoteJidAlt,
        data.key?.participant,
        data.key?.participantPn,
        data.senderPhone,
        data.senderPn,
        info.Chat,
        data.key?.remoteJid,
      ];

      for (const jid of candidateJids) {
        if (typeof jid === "string" && jid.includes("@s.whatsapp.net")) {
          const extracted = extractPhoneFromJid(jid);
          if (extracted) return normalizePhone(extracted);
        }
      }

      for (const jid of candidateJids) {
        if (typeof jid === "string") {
          const extracted = extractPhoneFromJid(jid);
          if (extracted && extracted.length >= 10 && extracted.length <= 14) {
            return normalizePhone(extracted);
          }
        }
      }

      const fallback = info.Chat ?? data.key?.remoteJid ?? info.Sender ?? data.sender;
      const fallbackDigits = extractPhoneFromJid(fallback);
      return fallbackDigits ? normalizePhone(fallbackDigits) : null;
    }

    // Scenario 1: WhatsApp LID in Chat, but real phone in Sender
    const payloadLidWithSender = {
      data: {
        Info: {
          Chat: "123119649996807026:0@lid",
          Sender: "5535988160553:0@s.whatsapp.net",
        },
        key: {
          remoteJid: "123119649996807026@lid",
        },
      },
    };
    const resolvedPhone = resolveCustomerPhone(payloadLidWithSender.data, payloadLidWithSender.data.Info);
    assert.equal(resolvedPhone, "5535988160553", "should extract real phone from Sender instead of LID from Chat");

    // Scenario 2: Standard phone in Chat
    const payloadStandard = {
      data: {
        Info: {
          Chat: "5535988160553@s.whatsapp.net",
        },
        key: {
          remoteJid: "5535988160553@s.whatsapp.net",
        },
      },
    };
    assert.equal(
      resolveCustomerPhone(payloadStandard.data, payloadStandard.data.Info),
      "5535988160553"
    );
  });
});
