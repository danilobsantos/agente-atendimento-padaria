import { normalizePhone } from "./company";

/**
 * Checks if a JID or string represents a WhatsApp Linked Identity (LID).
 * LIDs format: "<digits>@lid" or "<digits>:<device>@lid".
 */
export function isLidJid(jid: unknown): boolean {
  if (!jid || typeof jid !== "string") return false;
  return jid.includes("@lid") || jid.endsWith("@lid");
}

/**
 * Checks if a JID represents a WhatsApp Group.
 */
export function isGroupJid(jid: unknown): boolean {
  if (!jid || typeof jid !== "string") return false;
  return jid.includes("@g.us") || jid.endsWith("@g.us");
}

/**
 * Extracts a numeric phone number from a WhatsApp JID.
 * Explicitly rejects @lid and @g.us JIDs so that internal LID identifiers
 * (which can be 14-16 digits) are never mistaken for customer phone numbers.
 */
export function extractPhoneFromJid(jid: unknown): string | null {
  if (!jid || typeof jid !== "string") return null;

  // Never extract phone numbers from LID or Group JIDs
  if (isLidJid(jid) || isGroupJid(jid)) {
    return null;
  }

  const userPart = jid.split("@")[0].split(":")[0];
  const digits = userPart.replace(/\D/g, "");

  if (!digits || digits.length < 10) {
    return null;
  }

  // If explicitly a standard WhatsApp user JID (@s.whatsapp.net), accept valid E.164 digits
  if (jid.includes("@s.whatsapp.net")) {
    return digits;
  }

  // If raw string / unknown domain, accept standard phone lengths (10 to 13 digits)
  // Anything with 14+ digits without @s.whatsapp.net is likely a raw LID identifier
  if (digits.length >= 10 && digits.length <= 13) {
    return digits;
  }

  return null;
}

/**
 * Resolves the real customer phone number from an Evolution Go webhook payload.
 *
 * In WhatsApp / Evolution Go (whatsmeow), chats sometimes have a LID (e.g. 123119649996807...@lid or 91714765242460@lid)
 * in Info.Chat or key.remoteJid, while the real phone number is provided in Info.Sender, Info.SenderAlt,
 * data.sender, data.key.participant, data.key.remoteJidAlt, data.senderPhone, data.senderPn, etc.
 *
 * This function guarantees that:
 * 1. JIDs with @s.whatsapp.net are always prioritized.
 * 2. LIDs (@lid) are never parsed into customer phone numbers.
 * 3. Returns null if only LID identifiers were present in the payload.
 */
export interface EvolutionMessageInfo {
  SenderAlt?: string | null;
  Sender?: string | null;
  Chat?: string | null;
  ChatAlt?: string | null;
  Recipient?: string | null;
  IsFromMe?: boolean | null;
  [key: string]: unknown;
}

export interface EvolutionWebhookData {
  senderAlt?: string | null;
  sender?: string | null;
  senderPhone?: string | null;
  senderPn?: string | null;
  recipient?: string | null;
  recipientPhone?: string | null;
  recipientPn?: string | null;
  recipientAlt?: string | null;
  key?: {
    fromMe?: boolean | null;
    remoteJidAlt?: string | null;
    participant?: string | null;
    participantPn?: string | null;
    remoteJid?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export function resolveCustomerPhone(
  data?: EvolutionWebhookData | null,
  info?: EvolutionMessageInfo | null,
  optionsOrIsFromMe?: boolean | { isFromMe?: boolean }
): string | null {
  const isFromMe =
    typeof optionsOrIsFromMe === "boolean"
      ? optionsOrIsFromMe
      : Boolean(
          optionsOrIsFromMe?.isFromMe ??
            info?.IsFromMe ??
            data?.key?.fromMe
        );

  // When isFromMe is true, the message was sent by our staff / phone.
  // The sender is the store itself; the customer is the chat/recipient target.
  const candidateJids: unknown[] = isFromMe
    ? [
        data?.key?.remoteJidAlt,
        data?.recipientAlt,
        info?.ChatAlt,
        data?.recipientPhone,
        data?.recipientPn,
        data?.recipient,
        info?.Recipient,
        info?.Chat,
        data?.key?.remoteJid,
        data?.key?.participantPn,
        data?.key?.participant,
      ]
    : [
        info?.SenderAlt,
        info?.Sender,
        data?.senderAlt,
        data?.sender,
        data?.key?.remoteJidAlt,
        data?.key?.participant,
        data?.key?.participantPn,
        data?.senderPhone,
        data?.senderPn,
        info?.Chat,
        data?.key?.remoteJid,
      ];

  // 1. Highest priority: candidate explicitly ending in @s.whatsapp.net
  for (const jid of candidateJids) {
    if (typeof jid === "string" && jid.includes("@s.whatsapp.net")) {
      const extracted = extractPhoneFromJid(jid);
      if (extracted) {
        return normalizePhone(extracted);
      }
    }
  }

  // 2. Second priority: candidate with standard phone length (10 to 13 digits, non-LID)
  for (const jid of candidateJids) {
    if (typeof jid === "string" && !isLidJid(jid) && !isGroupJid(jid)) {
      const extracted = extractPhoneFromJid(jid);
      if (extracted && extracted.length >= 10 && extracted.length <= 13) {
        return normalizePhone(extracted);
      }
    }
  }

  // If all candidates were LIDs or non-phone identifiers, return null
  return null;
}

export interface ParsedContact {
  name: string;
  phone?: string;
}

/**
 * Extrai os contatos de mensagens contactMessage ou contactsArrayMessage do WhatsApp.
 * Suporta o formato vCard padrão procurando por waid ou campos TEL.
 */
export function parseContactMessage(message: Record<string, unknown>): ParsedContact[] {
  const result: ParsedContact[] = [];

  const extractVcardPhone = (vcard?: string): string | undefined => {
    if (!vcard) return undefined;
    // 1. Prioriza waid=5511...
    const waidMatch = vcard.match(/waid=(\d+)/i);
    if (waidMatch?.[1]) return waidMatch[1];
    // 2. Campo TEL (ex.: TEL;type=CELL;waid=... ou TEL;type=CELL:+55 11 99999-9999)
    const telMatch = vcard.match(/TEL[^:]*:([^\r\n]+)/i);
    if (telMatch?.[1]) {
      return telMatch[1].trim();
    }
    return undefined;
  };

  const contact = message.contactMessage as { displayName?: string; vcard?: string } | undefined;
  if (contact) {
    const name = contact.displayName || "Contato";
    const phone = extractVcardPhone(contact.vcard);
    result.push({ name, phone });
  }

  const contactsArr = message.contactsArrayMessage as {
    displayName?: string;
    contacts?: Array<{ displayName?: string; vcard?: string }>;
  } | undefined;
  if (Array.isArray(contactsArr?.contacts)) {
    for (const c of contactsArr.contacts) {
      const name = c.displayName || "Contato";
      const phone = extractVcardPhone(c.vcard);
      result.push({ name, phone });
    }
  }

  return result;
}
