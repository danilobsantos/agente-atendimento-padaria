import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getPhoneLookupVariants, normalizePhone } from "../src/lib/utils/company";
import { resolveCustomerPhone, extractPhoneFromJid, isLidJid, isGroupJid } from "../src/lib/utils/whatsapp";

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

  test("isLidJid and isGroupJid detect non-phone WhatsApp identifiers", () => {
    assert.equal(isLidJid("91714765242460@lid"), true);
    assert.equal(isLidJid("123119649996807026:0@lid"), true);
    assert.equal(isLidJid("5535988160553@s.whatsapp.net"), false);

    assert.equal(isGroupJid("120363024823904@g.us"), true);
    assert.equal(isGroupJid("5535988160553@s.whatsapp.net"), false);
  });

  test("extractPhoneFromJid returns null for LIDs and groups, but extracts valid phones", () => {
    assert.equal(extractPhoneFromJid("91714765242460@lid"), null);
    assert.equal(extractPhoneFromJid("123119649996807026:0@lid"), null);
    assert.equal(extractPhoneFromJid("120363024823904@g.us"), null);

    assert.equal(extractPhoneFromJid("5535988160553@s.whatsapp.net"), "5535988160553");
    assert.equal(extractPhoneFromJid("5535988160553:1@s.whatsapp.net"), "5535988160553");
  });

  test("resolveCustomerPhone prioritizes @s.whatsapp.net over @lid", () => {
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

    // Scenario 3: LID-only event (production bug scenario with 14-digit LID 91714765242460)
    const payloadLidOnly = {
      data: {
        Info: {
          Chat: "91714765242460@lid",
        },
        key: {
          remoteJid: "91714765242460@lid",
        },
        sender: "91714765242460@lid",
      },
    };
    assert.equal(
      resolveCustomerPhone(payloadLidOnly.data, payloadLidOnly.data.Info),
      null,
      "should return null for LID-only payload, preventing ghost customer creation"
    );
  });
});
