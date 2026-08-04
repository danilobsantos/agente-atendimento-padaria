import { evolutionGo } from "../services/evolution-go";
import { prisma } from "../prisma";
import { redisPub } from "../redis";

const MAX_CHUNK_LENGTH = 800;
const DELAY_BETWEEN_CHUNKS_MS = 1500;

/**
 * Splits a long message at natural breakpoints (double newlines, single newlines, or periods).
 */
function splitMessage(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_CHUNK_LENGTH) {
    let splitIndex = -1;

    // 1. Try splitting at double newline
    const doubleNewline = remaining.lastIndexOf("\n\n", MAX_CHUNK_LENGTH);
    if (doubleNewline > MAX_CHUNK_LENGTH * 0.3) {
      splitIndex = doubleNewline;
    }

    // 2. Try splitting at single newline
    if (splitIndex === -1) {
      const singleNewline = remaining.lastIndexOf("\n", MAX_CHUNK_LENGTH);
      if (singleNewline > MAX_CHUNK_LENGTH * 0.3) {
        splitIndex = singleNewline;
      }
    }

    // 3. Try splitting at period + space
    if (splitIndex === -1) {
      const period = remaining.lastIndexOf(". ", MAX_CHUNK_LENGTH);
      if (period > MAX_CHUNK_LENGTH * 0.3) {
        splitIndex = period + 1; // Include the period
      }
    }

    // 4. Hard split at max length
    if (splitIndex === -1) {
      splitIndex = MAX_CHUNK_LENGTH;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface SendChunkedParams {
  phone: string;
  customerId: string;
  tenantId: string;
  customerName: string;
  isHumanAttending: boolean;
  text: string;
}

/**
 * Splits a long message into chunks, saves each to the DB,
 * broadcasts to WebSocket, and sends via WhatsApp with "composing" presence in between.
 */
export async function sendChunkedResponse(params: SendChunkedParams): Promise<void> {
  const { phone, customerId, tenantId, customerName, isHumanAttending, text } = params;
  const chunks = splitMessage(text);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Show "typing..." before each chunk (except the first, which already has it)
    if (i > 0) {
      await evolutionGo.sendPresence(phone, "composing").catch(() => {});
      await delay(DELAY_BETWEEN_CHUNKS_MS);
    }

    // Save chunk to DB
    const botMessage = await prisma.chatMessage.create({
      data: {
        customerId,
        sender: "BOT",
        content: chunk,
      },
    });

    // Broadcast to WebSocket
    await redisPub.publish(
      `tenant:${tenantId}:message`,
      JSON.stringify({
        ...botMessage,
        customerName,
        phone,
        isHumanAttending,
      })
    );

    // Send via WhatsApp
    await evolutionGo.sendText({ number: phone, text: chunk });
  }
}
