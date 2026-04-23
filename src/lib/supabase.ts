function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing: ${name}`);
  return v;
}

export async function insertMessage(msg: {
  chat_id: number; from_name: string | null; from_username: string | null;
  message_text: string | null; business_connection_id: string | null;
  chat_type: string; chat_title: string | null; source?: string;
}): Promise<void> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  const res = await fetch(`${url}/rest/v1/messages`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(msg),
  });
  if (!res.ok) throw new Error(`Supabase INSERT failed: ${res.status} ${await res.text()}`);
}

export async function getMessages(hoursBack: number, businessConnectionId?: string | null): Promise<any[]> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
const filter = businessConnectionId ? `&business_connection_id=eq.${businessConnectionId}` : ``;
const res = await fetch(`${url}/rest/v1/messages?received_at=gte.${since}&is_processed=eq.false&order=received_at.asc${filter}`, {
  });
  if (!res.ok) throw new Error(`Supabase SELECT failed: ${res.status}`);
  return res.json();
}
export async function markMessagesAsProcessed(businessConnectionId?: string | null): Promise<void> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  const filter = businessConnectionId ? `&business_connection_id=eq.${businessConnectionId}` : `&business_connection_id=is.null`;
  await fetch(`${url}/rest/v1/messages?is_processed=eq.false${filter}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ is_processed: true }),
  });
}

export async function savePendingAction(chatId: number, actionType: string, payload: any): Promise<void> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  await fetch(`${url}/rest/v1/pending_actions`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_chat_id: chatId, action_type: actionType, payload }),
  });
}

export async function getPendingAction(chatId: number): Promise<any | null> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  const res = await fetch(`${url}/rest/v1/pending_actions?user_chat_id=eq.${chatId}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  return data[0] || null;
}

export async function deletePendingAction(chatId: number): Promise<void> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  await fetch(`${url}/rest/v1/pending_actions?user_chat_id=eq.${chatId}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

export async function saveConversation(chatId: number, role: string, content: string): Promise<void> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  await fetch(`${url}/rest/v1/conversations`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ user_chat_id: chatId, role, content }),
  });
}

export async function getConversationHistory(chatId: number, limit = 10): Promise<any[]> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  const res = await fetch(`${url}/rest/v1/conversations?user_chat_id=eq.${chatId}&order=created_at.desc&limit=${limit}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  return data.reverse();
}

export async function saveReminder(text: string, scheduledAt: string): Promise<void> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  await fetch(`${url}/rest/v1/reminders`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ message_text: text, scheduled_at: scheduledAt }),
  });
}

export async function getPendingReminders(): Promise<any[]> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  const now = new Date().toISOString();
  const res = await fetch(`${url}/rest/v1/reminders?sent=eq.false&scheduled_at=lte.${now}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return res.json();
}

export async function markReminderSent(id: string): Promise<void> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");
  await fetch(`${url}/rest/v1/reminders?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sent: true }),
  });
}
