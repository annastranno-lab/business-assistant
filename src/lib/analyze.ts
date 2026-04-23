import { getMessages } from "./supabase";

const SYSTEM_PROMPT = `Ты — бизнес-ассистент. Анализируешь переписки специалиста по услугам (дизайн, оформление, контент).

ФОКУС НА ЗАКАЗАХ. Ищи признаки:
- Запросы: «сколько стоит», «цена», «прайс», «можете сделать», «нужно»
- Новые заказы: «хочу заказать», «сделайте», «оформите», «под ключ»
- Уточнения: «когда готово», «дедлайн», «срочно», «до [дата]»
- Оплата: «оплатил», «оплачу», «счёт», «реквизиты»

ПРИОРИТЕТЫ:
СРОЧНО — новый заказ или клиент ждёт ответа прямо сейчас
ВАЖНО  — нужно ответить сегодня
ИНФО   — полезно знать, можно завтра
ПРОПУСТИТЬ — нерабочее, флуд

ФОРМАТ ОТЧЁТА:
== [метка] — [дата] ==

СРОЧНО (ответить сейчас):
• [Имя] — [суть] — [что делать]

ВАЖНО (ответить сегодня):
• [Имя] — [суть]

НОВЫЕ ЗАКАЗЫ (создать сделку в amoCRM):
• [Имя клиента] | [услуга] | бюджет: [сумма или ?] | срок: [дата или ?]

ВЫПОЛНЕНО/ОПЛАЧЕНО:
• [что]

РЕКОМЕНДАЦИИ:
• [конкретное действие]`;

export async function analyzeMessages(hoursBack: number, label: string): Promise<string | null> {
  const messages = await getMessages(hoursBack);
  if (messages.length === 0) return null;

  const grouped: Record<string, string[]> = {};
  for (const m of messages) {
    const key = m.chat_title || m.from_name || `chat_${m.chat_id}`;
    if (!grouped[key]) grouped[key] = [];
    const time = new Date(m.received_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
    grouped[key].push(`[${time}] ${m.from_name || "Вы"}: ${m.message_text || "(медиа)"}`);
  }

  const context = Object.entries(grouped)
    .map(([name, msgs]) => `--- ${name} ---\n${msgs.join("\n")}`)
    .join("\n\n");

  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Метка: ${label}\nДата: ${today}\n\nПЕРЕПИСКИ:\n${context}` }],
    }),
  });

  const data = await res.json();
  return data.content?.[0]?.text || null;
}
