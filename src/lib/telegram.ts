function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing: ${name}`);
  return v;
}

function splitMessage(text: string, max = 4096): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= max) { chunks.push(remaining); break; }
    const slice = remaining.slice(0, max);
    const cut = slice.lastIndexOf("\n\n") > 0 ? slice.lastIndexOf("\n\n") : slice.lastIndexOf("\n") > 0 ? slice.lastIndexOf("\n") : max;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, "");
  }
  return chunks;
}

export async function sendToMe(text: string): Promise<void> {
  await sendMessage(requireEnv("TELEGRAM_MY_CHAT_ID"), text);
}

export async function sendMessage(chatId: string | number, text: string, replyMarkup?: any): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  for (const chunk of splitMessage(text)) {
    const body: any = { chat_id: chatId, text: chunk, parse_mode: "Markdown" };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}

export async function sendBusinessMessage(businessConnectionId: string, chatId: number, text: string): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ business_connection_id: businessConnectionId, chat_id: chatId, text }),
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const info = await infoRes.json();
  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${info.result.file_path}`);
  return fileRes.arrayBuffer();
}
