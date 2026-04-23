import { NextResponse } from "next/server";
import { insertMessage } from "@/lib/supabase";

function hashCode(str: string): number {
  return [...str].reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await insertMessage({
    chat_id: Math.abs(hashCode(body.from_phone || body.from_id || "unknown")),
    from_name: body.from_name || "Unknown",
    from_username: body.from_username || null,
    message_text: body.text,
    business_connection_id: null,
    chat_type: "private",
    chat_title: null,
    source: body.source || "external",
  });
  return NextResponse.json({ ok: true });
}
