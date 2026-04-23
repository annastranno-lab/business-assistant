import { downloadFile } from "./telegram";

export async function transcribeVoice(fileId: string): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY!;
  const audio = await downloadFile(fileId);
  const res = await fetch("https://api.deepgram.com/v1/listen?language=ru&model=nova-2&smart_format=true", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "audio/ogg" },
    body: audio,
  });
  if (!res.ok) throw new Error(`Deepgram error: ${res.status}`);
  const data = await res.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}
