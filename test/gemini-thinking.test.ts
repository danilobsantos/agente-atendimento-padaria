import { test } from "node:test";
import assert from "node:assert/strict";
import { GeminiAdapter } from "../src/lib/adapters/gemini";
import type { LLMMessage } from "../src/lib/types/llm";

const OK_CANDIDATE = {
  candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }],
};

function call(model: string, thinkingConfig?: string) {
  return new Promise<Record<string, unknown>>((resolve) => {
    const original = globalThis.fetch;
    globalThis.fetch = async (_input: string | URL | Request, init: RequestInit = {}) => {
      globalThis.fetch = original;
      resolve(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(OK_CANDIDATE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const messages: LLMMessage[] = [{ role: "user", content: "teste" }];
    void new GeminiAdapter()
      .generate(messages, { apiKey: "k", model, ...(thinkingConfig && { thinkingConfig }) })
      .catch(() => {});
  });
}

test("gemini 3.x maps thinkingConfig keyword to thinkingLevel", async () => {
  const body = await call("gemini-3.5-flash", "low");
  const gc = body.generationConfig as Record<string, unknown>;
  assert.deepEqual(gc.thinkingConfig, { thinkingLevel: "low" });
});

test("gemini 3.6 accepts minimal level", async () => {
  const body = await call("gemini-3.6-flash", "minimal");
  const gc = body.generationConfig as Record<string, unknown>;
  assert.deepEqual(gc.thinkingConfig, { thinkingLevel: "minimal" });
});

test("gemini 2.5 maps numeric thinkingConfig to thinkingBudget", async () => {
  const body = await call("gemini-2.5-flash", "1024");
  const gc = body.generationConfig as Record<string, unknown>;
  assert.deepEqual(gc.thinkingConfig, { thinkingBudget: 1024 });
});

test("gemini 3.x ignores invalid numeric value", async () => {
  const body = await call("gemini-3.5-flash", "1024");
  const gc = body.generationConfig as Record<string, unknown>;
  assert.equal("thinkingConfig" in gc, false);
});

test("no thinkingConfig omits the field", async () => {
  const body = await call("gemini-3.5-flash");
  const gc = body.generationConfig as Record<string, unknown>;
  assert.equal("thinkingConfig" in gc, false);
  assert.equal("thinkingLevel" in (gc as Record<string, unknown>), false);
});

test("tool response maps to role user with functionResponse", async () => {
  const original = globalThis.fetch;
  const bodyPromise = new Promise<Record<string, unknown>>((resolve) => {
    globalThis.fetch = async (_input: string | URL | Request, init: RequestInit = {}) => {
      globalThis.fetch = original;
      resolve(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(OK_CANDIDATE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const messages: LLMMessage[] = [
      { role: "user", content: "checa o estoque" },
      { role: "assistant", content: "", tool_calls: [{ id: "1", name: "checar_estoque", arguments: "{}" }] },
      { role: "tool", tool_call_id: "1", name: "checar_estoque", content: '{"disponivel":true}' },
    ];
    void new GeminiAdapter()
      .generate(messages, { apiKey: "k", model: "gemini-3.5-flash" })
      .catch(() => {});
  });

  const body = await bodyPromise;
  const toolContent = (body.contents as Array<Record<string, unknown>>)[2];
  assert.equal(toolContent.role, "user");
  const fr = (toolContent.parts as Array<{ functionResponse?: unknown }>)[0].functionResponse as {
    name: string;
    response: unknown;
  };
  assert.equal(fr.name, "checar_estoque");
  assert.deepEqual(fr.response, { result: '{"disponivel":true}' });
});