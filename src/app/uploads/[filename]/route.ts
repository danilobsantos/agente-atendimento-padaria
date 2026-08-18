import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isAllowedLogoExt } from "@/lib/utils/company";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Security: prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  if (!safeFilename || safeFilename !== filename || safeFilename.includes("..")) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const ext = (safeFilename.split(".").pop() ?? "").toLowerCase();
  if (!isAllowedLogoExt(ext)) {
    return new NextResponse("File type not allowed", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", safeFilename);

  try {
    const fileBuffer = await fs.readFile(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return new NextResponse("File not found", { status: 404 });
    }
    console.error("[Uploads Route] Error reading file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
