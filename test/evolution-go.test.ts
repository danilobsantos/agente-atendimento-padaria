import { test } from "node:test";
import assert from "node:assert/strict";
import { EvolutionGoService } from "../src/lib/services/evolution-go";

const INSTANCE = "padaria";

function makeService(): EvolutionGoService {
  return new EvolutionGoService({
    baseUrl: "http://evo.local",
    apiKey: "global-key",
    instanceToken: "instance-token",
    instanceName: INSTANCE,
  });
}

interface CapturedRequest {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

function mockFetch(response: Response | (() => Response | Promise<Response>)) {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    typeof response === "function"
      ? (response as () => Response | Promise<Response>)()
      : response;
  return () => {
    globalThis.fetch = original;
  };
}

test("getQrCode calls /instance/qr with instance token as apikey", async () => {
  const original = globalThis.fetch;
  let captured: CapturedRequest | null = null;
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    captured = {
      url: String(input),
      method: init.method,
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    return new Response(
      JSON.stringify({ data: { qrcode: { base64: "data:image/png;base64,ABC" } } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  try {
    const { base64 } = await makeService().getQrCode();
    assert.equal(base64, "data:image/png;base64,ABC");
    assert.equal(captured!.url, "http://evo.local/instance/qr");
    assert.equal(captured!.method, "GET");
    assert.equal(captured!.headers.apikey, "instance-token");
  } finally {
    globalThis.fetch = original;
  }
});

test("getQrCode parses flat base64 response", async () => {
  const restore = mockFetch(
    new Response(JSON.stringify({ base64: "flat-base64" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  try {
    const { base64 } = await makeService().getQrCode();
    assert.equal(base64, "flat-base64");
  } finally {
    restore();
  }
});

test("getQrCode reports alreadyConnected without throwing", async () => {
  const restore = mockFetch(new Response('{"error":"session already logged in"}', { status: 400 }));
  try {
    const qr = await makeService().getQrCode();
    assert.equal(qr.alreadyConnected, true);
    assert.equal(qr.base64, undefined);
  } finally {
    restore();
  }
});

test("getQrCode throws on other non-ok responses", async () => {
  const restore = mockFetch(new Response("boom", { status: 500 }));
  try {
    await assert.rejects(
      () => makeService().getQrCode(),
      /Evolution Go error \(500\): boom/
    );
  } finally {
    restore();
  }
});

test("getStatus calls /instance/status and parses Evolution Go payload", async () => {
  const original = globalThis.fetch;
  let captured: CapturedRequest | null = null;
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    captured = {
      url: String(input),
      method: init.method,
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    return new Response(
      JSON.stringify({ data: { Connected: true, LoggedIn: true, Name: "padaria" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  try {
    const status = await makeService().getStatus();
    assert.deepEqual(status, { connected: true, loggedIn: true });
    assert.equal(captured!.url, "http://evo.local/instance/status");
    assert.equal(captured!.headers.apikey, "instance-token");
  } finally {
    globalThis.fetch = original;
  }
});

test("getStatus reports not connected while only socket is up (not paired)", async () => {
  const restore = mockFetch(
    new Response(
      JSON.stringify({ data: { Connected: true, LoggedIn: false, Name: "padaria" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );
  try {
    const status = await makeService().getStatus();
    assert.deepEqual(status, { connected: false, loggedIn: false });
  } finally {
    restore();
  }
});

test("getStatus maps open state to connected", async () => {
  const restore = mockFetch(
    new Response(JSON.stringify({ instance: { state: "open" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  try {
    const status = await makeService().getStatus();
    assert.equal(status.connected, true);
  } finally {
    restore();
  }
});

test("ensureInstance reuses existing instance token", async () => {
  const original = globalThis.fetch;
  let captured: CapturedRequest | null = null;
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    captured = { url: String(input), headers: (init.headers ?? {}) as Record<string, string> };
    return new Response(
      JSON.stringify({ data: [{ name: INSTANCE, token: "existing-token" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  try {
    const result = await makeService().ensureInstance();
    assert.deepEqual(result, { created: false, token: "existing-token" });
    assert.equal(captured!.url, "http://evo.local/instance/all");
    assert.equal(captured!.headers.apikey, "global-key");
  } finally {
    globalThis.fetch = original;
  }
});

test("ensureInstance creates missing instance with name+token", async () => {
  const original = globalThis.fetch;
  const calls: CapturedRequest[] = [];
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({
      url: String(input),
      method: init.method,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await makeService().ensureInstance("https://app.local/api/webhooks/evolution");
    assert.deepEqual(result, { created: true, token: "instance-token" });

    const create = calls[1];
    assert.equal(create.method, "POST");
    assert.equal(calls[0].url, "http://evo.local/instance/all");
    assert.equal(create.url, "http://evo.local/instance/create");
    assert.equal(create.headers.apikey, "global-key");
    assert.deepEqual(create.body, { name: INSTANCE, token: "instance-token" });

    const connect = calls[2];
    assert.equal(connect.url, "http://evo.local/instance/connect");
    assert.equal(connect.headers.apikey, "instance-token");
    assert.equal(
      (connect.body as Record<string, unknown>).webhookUrl,
      "https://app.local/api/webhooks/evolution"
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("sendText calls /send/text with number+text", async () => {
  const original = globalThis.fetch;
  let captured: CapturedRequest | null = null;
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    captured = {
      url: String(input),
      method: init.method,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
    };
    return new Response(
      JSON.stringify({ key: {}, message: {}, status: "success" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  try {
    await makeService().sendText({ number: "31999990000", text: "oi" });
    assert.equal(captured!.url, "http://evo.local/send/text");
    assert.equal(captured!.method, "POST");
    assert.deepEqual(captured!.body, { number: "31999990000", text: "oi", delay: 1500 });
  } finally {
    globalThis.fetch = original;
  }
});

test("sendPresence calls /message/presence", async () => {
  const original = globalThis.fetch;
  let captured: CapturedRequest | null = null;
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    captured = {
      url: String(input),
      method: init.method,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
    };
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await makeService().sendPresence("31999990000", "composing");
    assert.equal(captured!.url, "http://evo.local/message/presence");
    assert.equal((captured!.body as Record<string, unknown>).state, "composing");
  } finally {
    globalThis.fetch = original;
  }
});