import { NextResponse } from "next/server";
import { insertMessage, getPendingAction, deletePendingAction, upsertBusinessConnection, getOwnerByConnection } from "@/lib/supabase";
import { transcribeVoice } from "@/lib/transcribe";
import { processAssistantMessage } from "@/lib/assistant";
import { sendMessage, answerCallbackQuery } from "@/lib/telegram";
import { createDeal } from "@/lib/amocrm";
import { generateTZ } from "@/lib/generate-tz";
import { getMessages } from "@/lib/supabase";
import { getPendingReminders, markReminderSent } from "@/lib/supabase";

const MY_CHAT_ID = process.env.TELEGRAM_MY_CHAT_ID!;

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
// Handle business connection event
    if (body.business_connection) {
      const conn = body.business_connection;
      await upsertBusinessConnection(
        conn.id,
        conn.user.id,
        conn.user.first_name ?? "Unknown"
      );
      return NextResponse.json({ ok: true });
    }
    // Check reminders on every request
    try {
      const reminders = await getPendingReminders();
      for (const r of reminders) {
        await sendMessage(MY_CHAT_ID, `⏰ Напоминание: ${r.message_text}`);
        await markReminderSent(r.id);
      }
    } catch {}

    // Handle callback query (button press)
    if (body.callback_query) {
      const cq = body.callback_query;
      const chatId = cq.from.id;
      await answerCallbackQuery(cq.id);

      if (cq.data === "confirm_deal") {
        const pending = await getPendingAction(chatId);
        if (pending?.action_type === "create_deal") {
          const p = pending.payload;
          try {
            const { dealId, dealUrl } = await createDeal({ name: p.service_name, budget: p.budget, deadline: p.deadline, clientName: p.client_name });
            await sendMessage(chatId, `✅ Сделка создана!\n\n[Открыть в amoCRM](${dealUrl})\n\nГенерирую ТЗ для команды...`);

            // Generate TZ
            const msgs = await getMessages(72);
            const clientMsgs = msgs.filter(m => m.from_name?.toLowerCase().includes(p.client_name.toLowerCase())).map(m => `${m.from_name}: ${m.message_text}`);
            const tz = await generateTZ({ clientName: p.client_name, serviceName: p.service_name, messages: clientMsgs, budget: p.budget, deadline: p.deadline });
            await sendMessage(chatId, tz);
          } catch (e) {
            await sendMessage(chatId, "❌ Ошибка создания сделки. Проверьте настройки amoCRM.");
          }
          await deletePendingAction(chatId);
        }
      } else if (cq.data === "cancel_deal") {
        await deletePendingAction(chatId);
        await sendMessage(chatId, "Отменено.");
      }

      return NextResponse.json({ ok: true });
    }

    // Handle business message (from client chats)
    if (body.business_message) {
      const msg = body.business_message;
      let text = msg.text || null;

      // Transcribe voice
      if (msg.voice) {
        try { text = await transcribeVoice(msg.voice.file_id); } catch {}
      }

     const ownerUserId = await getOwnerByConnection(msg.business_connection_id);

      await insertMessage({
        chat_id: msg.chat.id,
        from_name: msg.from ? `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim() : null,
        from_username: msg.from?.username || null,
        message_text: text,
        business_connection_id: msg.business_connection_id,
        owner_user_id: ownerUserId,
        chat_type: msg.chat.type,
        chat_title: msg.chat.title || null,
        source: "telegram",
      });
      return NextResponse.json({ ok: true });
    }

    // Handle direct message to bot (commands)
    if (body.message) {
      const msg = body.message;
      const chatId = msg.chat.id;

      let text = msg.text || null;

      // Transcribe voice command
      if (msg.voice) {
        try {
          text = await transcribeVoice(msg.voice.file_id);
          await sendMessage(chatId, `🎤 Распознал: _${text}_`);
        } catch {
          await sendMessage(chatId, "Не смог распознать голосовое.");
          return NextResponse.json({ ok: true });
        }
      }

      if (!text) return NextResponse.json({ ok: true });

const ownerUserId = msg.business_connection_id
  ? await getOwnerByConnection(msg.business_connection_id)
  : null;
const response = await processAssistantMessage(chatId, text, ownerUserId);      if (response) await sendMessage(chatId, response);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true }); // Always 200 for Telegram
  }
}
