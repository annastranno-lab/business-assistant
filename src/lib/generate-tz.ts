export async function generateTZ(params: {
  clientName: string; serviceName: string; messages: string[];
  budget?: number; deadline?: string;
}): Promise<string> {
const prompt = `Составь профессиональное техническое задание для команды дизайнеров/исполнителей.
Сегодняшняя дата: ${new Date().toLocaleDateString('ru-RU')}.

ДАННЫЕ ЗАКАЗА:
Клиент: ${params.clientName}
Услуга: ${params.serviceName}
Бюджет: ${params.budget ? params.budget + " руб" : "не уточнён"}
Дедлайн: ${params.deadline || "не уточнён"}

ПЕРЕПИСКА С КЛИЕНТОМ:
${params.messages.join("\n") || "Переписка не предоставлена"}

Составь подробное ТЗ в формате:

ТЗ: ${params.serviceName}
Клиент: ${params.clientName} | Дедлайн: ${params.deadline || "уточнить"} | Бюджет: ${params.budget ? params.budget + " руб" : "уточнить"}

--- ЧТО НУЖНО СДЕЛАТЬ ---
[Чёткое описание задачи. Конкретные элементы работы. Форматы файлов.]

--- ВАЖНЫЕ ДЕТАЛИ ОТ КЛИЕНТА ---
[Все пожелания, стиль, примеры, предпочтения из переписки]
[Что НЕ нравится — если упоминал]
[Если переписки нет — написать "Уточнить у клиента"]

--- НУЖНО УТОЧНИТЬ ---
[Что осталось непонятным. Без чего нельзя начать работу.]

--- РЕЗУЛЬТАТ СДАЧИ ---
[Что именно передаётся клиенту: форматы, количество вариантов, способ передачи]`;
ДАННЫЕ:
Клиент: ${params.clientName}
Услуга: ${params.serviceName}
Бюджет: ${params.budget ? params.budget + " руб" : "не уточнён"}
Дедлайн: ${params.deadline || "не уточнён"}

ПЕРЕПИСКА С КЛИЕНТОМ:
${params.messages.join("\n")}

ФОРМАТ ТЗ:

ТЗ: ${params.serviceName}
Клиент: ${params.clientName} | Дедлайн: ${params.deadline || "не уточнён"} | Бюджет: ${params.budget ? params.budget + " руб" : "не уточнён"}

--- ЧТО НУЖНО СДЕЛАТЬ ---
[Чёткое описание задачи. Конкретные элементы работы.]

--- ВАЖНЫЕ ДЕТАЛИ ОТ КЛИЕНТА ---
[Все пожелания, стиль, примеры, предпочтения из переписки]
[Что НЕ нравится клиенту — если упоминал]

--- НУЖНО УТОЧНИТЬ ---
[Что осталось непонятным. Без чего нельзя начать.]

--- РЕЗУЛЬТАТ СДАЧИ ---
[Что именно передаётся клиенту]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return data.content[0].text;
}
