import { NextResponse } from "next/server";
import { getPendingReminders, markReminderSent } from "@/lib/supabase";
import { sendToMe } from "@/lib/telegram";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reminders = await getPendingReminders();
  for (const r of reminders) {
    await sendToMe(`⏰ Напоминание: ${r.message_text}`);
    await markReminderSent(r.id);
  }
  return NextResponse.json({ success: true, sent: reminders.length });
}
