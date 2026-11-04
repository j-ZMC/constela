import { KEEP_ALIVE, MODEL_OPTIONS, buildMessages, interviewRequest, ollamaModel, ollamaUrl } from "@/lib/interview";
import { warmVoice } from "@/lib/kokoro";
import { warmWhisper } from "@/lib/whisper";

// Gets the models ready while the person reads the start screen: it loads the chat model and reads the rules
// every activity shares once. Ollama reuses what it already read, so the first answer does not wait for either
// (reading the rules on a CPU takes about 5 seconds). { voice: true } starts Whisper too (the person will talk);
// { speak: true } starts Kokoro (the AI will talk). Nothing from the person is sent, and a failure changes
// nothing: the first answer simply waits like before.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (body?.voice === true) warmWhisper();
  if (body?.speak === true) warmVoice();
  const [rules] = buildMessages(interviewRequest.parse({ messages: [] }));
  try {
    await fetch(`${ollamaUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel(),
        messages: [rules],
        stream: false,
        keep_alive: KEEP_ALIVE,
        options: { ...MODEL_OPTIONS, num_predict: 1 },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    // Ollama is not running; the chat itself will say so.
  }
  return new Response(null, { status: 204 });
}
