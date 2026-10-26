"use client";

// Остання межа: помилка в самому кореневому layout. Замінює його, тож потрібні власні html/body і стилі (шрифт — системний:
// next/font тут недоступний). Повторити спроба — перезавантаження сторінки.
import "./globals.css";
import { useEffect } from "react";
import { Button, StatusPage } from "@/components/ui";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <StatusPage
          standalone
          icon="alert"
          tone="danger"
          title="Something went wrong"
          description="We could not load the application. Reload the page; if it keeps happening, contact your administrator."
          reference={error.digest}
          actions={<Button onClick={() => window.location.reload()}>Reload page</Button>}
        />
      </body>
    </html>
  );
}
