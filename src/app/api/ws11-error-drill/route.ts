// ТИМЧАСОВО (WS11, трек B): навмисна помилка сервера, щоб побачити повідомлення onRequestError у Telegram з маршрутом і
// стеком. Лише для залогінених і лише на preview: на проді відповідає 404. Другий коміт цього PR прибирає маршрут до
// злиття в main.
import { requireActiveUser } from "@/lib/auth/session";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV === "production") return new Response("Not found", { status: 404 });
  await requireActiveUser();
  throw new Error("WS11 deliberate error drill");
}
