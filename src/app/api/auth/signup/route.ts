import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json(
    { error: "O cadastro de novos parceiros está temporariamente desativado." },
    { status: 403 }
  );
}
