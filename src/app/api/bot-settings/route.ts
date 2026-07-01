import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/bot-settings?tenantId=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const settings = await prisma.botSetting.findUnique({
    where: { tenantId },
  });

  if (!settings) {
    return NextResponse.json({ error: "Bot settings not found" }, { status: 404 });
  }

  // Never expose the full API key to the frontend
  return NextResponse.json({
    ...settings,
    llmApiKey: settings.llmApiKey ? "••••" + settings.llmApiKey.slice(-4) : "",
  });
}

// PUT /api/bot-settings — Create or update bot settings
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      tenantId,
      llmProvider,
      llmApiKey,
      llmModel,
      systemPrompt,
      debounceSeconds,
      sessionTimeout,
      messageContextLimit,
      isActive,
    } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    const settings = await prisma.botSetting.upsert({
      where: { tenantId },
      update: {
        ...(llmProvider !== undefined && { llmProvider }),
        ...(llmApiKey !== undefined && llmApiKey !== "" && { llmApiKey }),
        ...(llmModel !== undefined && { llmModel }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(debounceSeconds !== undefined && { debounceSeconds }),
        ...(sessionTimeout !== undefined && { sessionTimeout: parseInt(sessionTimeout) }),
        ...(messageContextLimit !== undefined && { messageContextLimit: parseInt(messageContextLimit) }),
        ...(isActive !== undefined && { isActive }),
      },
      create: {
        tenantId,
        llmProvider: llmProvider ?? "DEEPSEEK",
        llmApiKey: llmApiKey ?? "",
        llmModel: llmModel ?? "deepseek-chat",
        systemPrompt: systemPrompt ?? "",
        debounceSeconds: debounceSeconds ?? 5,
        sessionTimeout: sessionTimeout ? parseInt(sessionTimeout) : 1800,
        messageContextLimit: messageContextLimit ? parseInt(messageContextLimit) : 15,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({
      ...settings,
      llmApiKey: settings.llmApiKey ? "••••" + settings.llmApiKey.slice(-4) : "",
    });
  } catch (error: any) {
    console.error("[BotSettings] Error:", error);
    try {
      const fs = require("fs");
      const path = require("path");
      fs.writeFileSync(
        path.join(process.cwd(), "settings-error.log"),
        `${new Date().toISOString()}\nError: ${error?.message || error}\nStack: ${error?.stack || "no-stack"}\n`
      );
    } catch (fsErr) {
      console.error("Failed to write settings error log:", fsErr);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
