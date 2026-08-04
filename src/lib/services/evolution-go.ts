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

export class EvolutionGoService {
  private baseUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || "http://localhost:8080";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || "default";
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      apikey: this.apiKey,
    };
  }

  async sendText(params: SendTextParams): Promise<SendTextResponse> {
    const url = `${this.baseUrl}/message/sendText/${this.instanceName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        number: params.number,
        text: params.text,
        delay: params.delay ?? 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Evolution Go error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async sendPresence(number: string, presence: "composing" | "recording" | "paused"): Promise<void> {
    const url = `${this.baseUrl}/chat/updatePresence/${this.instanceName}`;

    await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ number, presence }),
    });
  }

  async sendButtons(params: {
    number: string;
    title?: string;
    description: string;
    footer?: string;
    buttons: Array<{ id: string; displayText: string }>;
  }): Promise<SendTextResponse> {
    const url = `${this.baseUrl}/message/sendButtons/${this.instanceName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Evolution Go error (${response.status}): ${error}`);
    }

    return response.json();
  }
}

export const evolutionGo = new EvolutionGoService();
