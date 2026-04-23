import { NextResponse } from "next/server";
import { analyzeMessages } from "@/lib/analyze";
import { sendToMe } from "@/lib/telegram";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hour = new Date().getUTCHours();
  const label = hour === 8 ? "УТРЕННИЙ ОТЧЁТ (11:00)" : "ДНЕВНОЙ ОТЧЁТ (15:00)";
  const hoursBack = hour === 8 ? 15 : 4;
  const report = await analyzeMessages(hoursBack, label);
  await sendToMe(report ?? "📭 За этот период новых рабочих сообщений не было.");
  return NextResponse.json({ success: true });
}
