interface SendTextParams {
  number: string;
  text: string;
  delay?: number;
}

interface SendTextResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation: string;
  };
  status: string;
}

export interface EvolutionGoConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  instanceToken?: string;
}

export interface EvolutionStatusShape {
  Connected?: boolean;
  connected?: boolean;
  LoggedIn?: boolean;
  loggedIn?: boolean;
  state?: string;
  status?: string;
  instance?: EvolutionStatusShape;
  data?: EvolutionStatusShape;
  qrcode?: string | { base64?: string; code?: string };
  base64?: string;
  code?: string;
}

export class EvolutionGoService {
  private baseUrl: string;
  private apiKey: string;
  private instanceName: string;
  private instanceToken: string;

  constructor(config?: Partial<EvolutionGoConfig>) {
    this.baseUrl = config?.baseUrl || process.env.EVOLUTION_API_URL || "http://localhost:8080";
    this.apiKey = config?.apiKey || process.env.EVOLUTION_API_KEY || "";
    this.instanceName = config?.instanceName || process.env.EVOLUTION_INSTANCE_NAME || "default";
    this.instanceToken = config?.instanceToken || process.env.EVOLUTION_INSTANCE_TOKEN || "";
  }

  // Ops administrativas (criar/listar instâncias) usam a chave global.
  // Ops da instância (status/qr/envio) usam o token da instância como apikey.
  private getHeaders(scope: "admin" | "instance" = "instance"): Record<string, string> {
    const apikey = scope === "instance" ? this.instanceToken || this.apiKey : this.apiKey;
    return {
      "Content-Type": "application/json",
      apikey,
    };
  }

  async sendText(params: SendTextParams): Promise<SendTextResponse> {
    const body = await this.jsonFetch<SendTextResponse>(`${this.baseUrl}/send/text`, {
      method: "POST",
      body: JSON.stringify({
        number: params.number,
        text: params.text,
        delay: params.delay ?? 1500,
      }),
    });
    return body;
  }

  async sendPresence(number: string, presence: "composing" | "recording" | "paused"): Promise<void> {
    await this.jsonFetch(`${this.baseUrl}/message/presence`, {
      method: "POST",
      body: JSON.stringify({ number, state: presence, isAudio: false, delay: 0 }),
    });
  }

  async sendButtons(params: {
    number: string;
    title?: string;
    description: string;
    footer?: string;
    buttons: Array<{ id: string; displayText: string }>;
  }): Promise<SendTextResponse> {
    const body = await this.jsonFetch<SendTextResponse>(`${this.baseUrl}/send/button`, {
      method: "POST",
      body: JSON.stringify({
        number: params.number,
        title: params.title || "",
        description: params.description,
        footer: params.footer || "",
        buttons: params.buttons.map((btn) => ({
          type: "reply",
          displayText: btn.displayText,
          id: btn.id,
        })),
      }),
    });
    return body;
  }

  private async jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { ...this.getHeaders("instance"), ...(init?.headers ?? {}) },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Evolution Go error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // GET /instance/qr — QR base64 (ou aviso de sessão já conectada)
  async getQrCode(): Promise<{ base64?: string; code?: string; alreadyConnected?: boolean }> {
    const response = await fetch(`${this.baseUrl}/instance/qr`, {
      method: "GET",
      headers: this.getHeaders("instance"),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("already logged in")) {
        return { alreadyConnected: true };
      }
      throw new Error(`Evolution Go error (${response.status}): ${errorText}`);
    }

    const body = await response.json();
    const qrString = (v: string | { base64?: string; code?: string } | undefined) =>
      typeof v === "string" ? v : (v as { base64?: string } | undefined)?.base64;
    return {
      base64: qrString(body.base64 || body.qrcode || body.data?.qrcode),
      code: body.code ?? body.data?.code ?? (body.qrcode as { code?: string } | undefined)?.code ?? body.data?.qrcode?.code,
    };
  }

  // GET /instance/status
  // Evolution Go: Connected = websocket ativo; LoggedIn = dispositivo pareado.
  // O app considera "conectado" apenas o aparelho pareado (LoggedIn / state open).
  async getStatus(): Promise<{ connected: boolean; loggedIn: boolean }> {
    const body = await this.jsonFetch<EvolutionStatusShape>(`${this.baseUrl}/instance/status`);
    const loggedIn =
      body.loggedIn ?? body.LoggedIn ?? body.data?.loggedIn ?? body.data?.LoggedIn ?? false;
    const stateOpen =
      body.status === "open" ||
      body.data?.status === "open" ||
      body.instance?.state === "open" ||
      body.state === "open" ||
      body.data?.state === "open";
    const connected = !!loggedIn || stateOpen;
    return { connected, loggedIn: !!loggedIn };
  }

  // Garante que a instância configurada existe e retorna seu token.
  // Cria com { name, token } (chave global) e sincroniza o webhook via /instance/connect.
  async ensureInstance(
    webhookUrl?: string
  ): Promise<{ created: boolean; token?: string }> {
    const list = await this.jsonFetch<{ data?: Array<{ name: string; token: string; webhook?: string }> | null }>(
      `${this.baseUrl}/instance/all`,
      { headers: this.getHeaders("admin") }
    );
    const existing = list.data?.find((i) => i.name === this.instanceName);

    const token = existing?.token || this.instanceToken;
    if (!token) {
      return { created: false };
    }

    if (!existing) {
      await this.jsonFetch(`${this.baseUrl}/instance/create`, {
        method: "POST",
        headers: this.getHeaders("admin"),
        body: JSON.stringify({ name: this.instanceName, token }),
      });
    }

    // Sincroniza o webhook sempre que a instância ainda não tiver a URL configurada.
    if (webhookUrl && existing?.webhook !== webhookUrl) {
      await this.jsonFetch(`${this.baseUrl}/instance/connect`, {
        method: "POST",
        body: JSON.stringify({ webhookUrl, subscribe: ["MESSAGE", "CONNECTION", "QRCODE"] }),
      }).catch(() => {});
    }

    return { created: !existing, token };
  }
}

export const evolutionGo = new EvolutionGoService();