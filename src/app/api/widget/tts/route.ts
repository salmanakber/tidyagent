import { NextResponse } from "next/server";
import { z } from "zod";
import { synthesizePiper } from "@/modules/voice/piper";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  let text = "";
  try {
    const body = z.object({ text: z.string().min(1).max(800) }).parse(await request.json());
    text = body.text;
  } catch {
    return NextResponse.json({ error: "Invalid text" }, { status: 400, headers: corsHeaders() });
  }

  const wav = await synthesizePiper(text);
  if (!wav) {
    return NextResponse.json({ error: "Piper TTS is not running" }, { status: 503, headers: corsHeaders() });
  }

  return new NextResponse(new Uint8Array(wav), {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "audio/wav",
      "Content-Length": String(wav.length),
    },
  });
}
