// Next.js 16: proxy.ts замість middleware.ts. З --src-dir файл МАЄ лежати в src/,
// інакше його мовчки ігнорують. Перевірка: `npm run build` показує «ƒ Proxy (Middleware)».
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Усі шляхи, крім статики Next.js, favicon і зображень.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
