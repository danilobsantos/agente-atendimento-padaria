import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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

  // Never expose the full API key or token to the frontend
  return NextResponse.json({
    ...settings,
    llmApiKey: settings.llmApiKey ? "••••" + settings.llmApiKey.slice(-4) : "",
    evolutionInstanceToken: settings.evolutionInstanceToken ? "••••••••" : "",
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
      maxOutputTokens,
      temperature,
      thinkingConfig,
      isActive,
      evolutionInstanceName,
      evolutionInstanceToken,
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
        ...(maxOutputTokens !== undefined && { maxOutputTokens: parseInt(maxOutputTokens) }),
        ...(temperature !== undefined && { temperature: parseFloat(temperature) }),
        ...(thinkingConfig !== undefined && { thinkingConfig: thinkingConfig ? String(thinkingConfig) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(evolutionInstanceName !== undefined && { evolutionInstanceName: evolutionInstanceName?.trim() || null }),
        ...(evolutionInstanceToken !== undefined && evolutionInstanceToken !== "" && { evolutionInstanceToken: evolutionInstanceToken.trim() }),
      },
      create: {
        tenantId,
        llmProvider: llmProvider ?? "DEEPSEEK",
        llmApiKey: llmApiKey ?? "",
        llmModel: llmModel ?? "deepseek-v4-flash",
        systemPrompt: systemPrompt ?? "",
        debounceSeconds: debounceSeconds ?? 5,
        sessionTimeout: sessionTimeout ? parseInt(sessionTimeout) : 1800,
        messageContextLimit: messageContextLimit ? parseInt(messageContextLimit) : 15,
        maxOutputTokens: maxOutputTokens ? parseInt(maxOutputTokens) : 4096,
        temperature: temperature ? parseFloat(temperature) : 0.7,
        ...(thinkingConfig !== undefined && { thinkingConfig: thinkingConfig ? String(thinkingConfig) : null }),
        isActive: isActive ?? true,
        evolutionInstanceName: evolutionInstanceName?.trim() || null,
        evolutionInstanceToken: evolutionInstanceToken?.trim() || null,
      },
    });

    return NextResponse.json({
      ...settings,
      llmApiKey: settings.llmApiKey ? "••••" + settings.llmApiKey.slice(-4) : "",
      evolutionInstanceToken: settings.evolutionInstanceToken ? "••••••••" : "",
    });
  } catch (error: unknown) {
    console.error("[BotSettings] Error:", error);
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack || "no-stack" : "no-stack";
      fs.writeFileSync(
        path.join(process.cwd(), "settings-error.log"),
        `${new Date().toISOString()}\nError: ${errorMsg}\nStack: ${errorStack}\n`
      );
    } catch (fsErr) {
      console.error("Failed to write settings error log:", fsErr);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
