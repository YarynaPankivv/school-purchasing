"use client";

// Помилка поза авторизованою частиною (наприклад, сторінка входу): без бічної панелі.
import { useEffect } from "react";
import { Button, StatusPage } from "@/components/ui";

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      standalone
      icon="alert"
      tone="danger"
      title="Something went wrong"
      description="We could not show this page. Try again; if it keeps happening, contact your administrator."
      reference={error.digest}
      actions={<Button onClick={() => retry()}>Try again</Button>}
    />
  );
}
