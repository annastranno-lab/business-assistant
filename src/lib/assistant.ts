import { getMessages, saveConversation, getConversationHistory, savePendingAction } from "./supabase";
import { generateTZ } from "./generate-tz";
import { createDeal } from "./amocrm";
import { sendMessage } from "./telegram";

const TOOLS = [
  {
    name: "create_deal",
    description: "Создать сделку в amoCRM по заказу клиента",
    input_schema: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "Имя клиента" },
        service_name: { type: "string", description: "Что нужно сделать" },
        budget: { type: "number", description: "Бюджет в рублях" },
        deadline: { type: "string", description: "Дедлайн YYYY-MM-DD" },
      },
      required: ["client_name", "service_name"],
    },
  },
  {
    name: "generate_tz",
    description: "Сгенерировать ТЗ для команды по заказу клиента",
    input_schema: {
      type: "object",
      properties: {
        client_name: { type: "string" },
        service_name: { type: "string" },
      },
      required: ["client_name", "service_name"],
    },
  },
  {
    name: "get_summary",
    description: "Показать кому срочно нужно ответить прямо сейчас",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "schedule_reminder",
    description: "Поставить напоминание",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Текст напоминания" },
        datetime: { type: "string", description: "Когда напомнить ISO 8601" },
      },
      required: ["text", "datetime"],
    },
  },
  {
    name: "search_messages",
    description: "Поиск по перепискам",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        from_name: { type: "string", description: "Фильтр по имени (опционально)" },
      },
      required: ["query"],
    },
  },
];

async function executeTool(name: string, input: any, userChatId: number): Promise<string> {
  if (name === "get_summary") {
    const msgs = await getMessages(4);
    if (msgs.length === 0) return "За последние 4 часа новых сообщений нет.";
    const lines = msgs.slice(-20).map(m => `${m.from_name || "?"}: ${m.message_text || "(медиа)"}`);
    return `Последние сообщения:\n${lines.join("\n")}`;
  }

  if (name === "search_messages") {
    const msgs = await getMessages(72);
    const q = input.query.toLowerCase();
    const filtered = msgs.filter(m =>
      m.message_text?.toLowerCase().includes(q) &&
      (!input.from_name || m.from_name?.toLowerCase().includes(input.from_name.toLowerCase()))
    ).slice(-10);
    if (filtered.length === 0) return "Ничего не найдено.";
    return filtered.map(m => `${m.from_name}: ${m.message_text}`).join("\n");
  }

  if (name === "schedule_reminder") {
    const { saveReminder } = await import("./supabase");
    await saveReminder(input.text, input.datetime);
    return `Напоминание установлено: "${input.text}" на ${input.datetime}`;
  }

  if (name === "create_deal") {
    // Save as pending action — require confirmation
    await savePendingAction(userChatId, "create_deal", input);
    return `PENDING_CONFIRMATION:create_deal:${JSON.stringify(input)}`;
  }

 if (name === "generate_tz") {
    const msgs = await getMessages(720); // 30 дней
    const q = input.client_name.toLowerCase();
    const clientMsgs = msgs
      .filter(m => 
        m.from_name?.toLowerCase().includes(q) ||
        m.from_username?.toLowerCase().includes(q) ||
        m.message_text?.toLowerCase().includes(q)
      )
      .map(m => `${m.from_name}: ${m.message_text}`);
    const tz = await generateTZ({ 
      clientName: input.client_name, 
      serviceName: input.service_name, 
      messages: clientMsgs.length > 0 ? clientMsgs : ["Переписка не найдена — составь ТЗ на основе названия услуги"]
    });
    return tz;
  }

  return "Инструмент не найден.";
}

export async function processAssistantMessage(userChatId: number, userText: string, ownerUserId?: number | null): Promise<string> {
  await saveConversation(userChatId, "user", userText);
  const history = await getConversationHistory(userChatId, 10);
  const msgs = await getMessages(4, ownerUserId);
const recentContext = msgs.slice(-10).map(m => `${m.from_name}: ${m.message_text}`).join("\n");
const systemPrompt = `Ты — AI-ассистент для управления рабочими задачами и заказами.
Помогаешь отвечать на вопросы о переписках, создавать сделки в amoCRM, генерировать ТЗ для команды.

ПОСЛЕДНИЕ СООБЩЕНИЯ ИЗ ЧАТОВ (контекст):
${recentContext || "Нет недавних сообщений"}

Отвечай кратко и по делу. Используй инструменты когда нужно.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: systemPrompt,
      tools: TOOLS,
      messages: history.map(h => ({ role: h.role, content: h.content })),
    }),
  });

  const data = await res.json();
if (data.error) {
    console.error('Anthropic API error:', JSON.stringify(data.error));
    return `Ошибка API: ${data.error.message}`;
  }
  // Check for tool use
  const toolUse = data.content?.find((b: any) => b.type === "tool_use");
  if (toolUse) {
    const result = await executeTool(toolUse.name, toolUse.input, userChatId);

    // Handle confirmation flow
    if (result.startsWith("PENDING_CONFIRMATION:create_deal:")) {
      const payload = JSON.parse(result.split("PENDING_CONFIRMATION:create_deal:")[1]);
      const preview = `📦 *НОВЫЙ ЗАКАЗ*\n\nКлиент: ${payload.client_name}\nУслуга: ${payload.service_name}\nБюджет: ${payload.budget ? payload.budget + " руб" : "не указан"}\nДедлайн: ${payload.deadline || "не указан"}\n\nСоздать сделку в amoCRM?`;
      const keyboard = {
        inline_keyboard: [[
          { text: "✅ Создать сделку", callback_data: "confirm_deal" },
          { text: "❌ Отмена", callback_data: "cancel_deal" },
        ]],
      };
      await sendMessage(userChatId, preview, keyboard);
      return "";
    }

    // Get final response from Claude with tool result
    const finalRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: systemPrompt,
        tools: TOOLS,
        messages: [
          ...history.map(h => ({ role: h.role, content: h.content })),
          { role: "assistant", content: data.content },
          { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result }] },
        ],
      }),
    });
    const finalData = await finalRes.json();
    const finalText = finalData.content?.find((b: any) => b.type === "text")?.text || "Готово!";
    await saveConversation(userChatId, "assistant", finalText);
    return finalText;
  }

  const text = data.content?.find((b: any) => b.type === "text")?.text || "Не понял запрос.";
  await saveConversation(userChatId, "assistant", text);
  return text;
}
