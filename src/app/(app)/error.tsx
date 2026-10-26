"use client";

// Помилка під час відображення сторінки застосунку: бічна панель лишається, можна повторити або піти на головну.
import { useEffect } from "react";
import { Button, LinkButton, StatusPage, TopBar } from "@/components/ui";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <TopBar showNewRequest />
      <StatusPage
        icon="alert"
        tone="danger"
        title="Something went wrong"
        description="We could not show this page. Try again; if it keeps happening, contact your administrator."
        reference={error.digest}
        actions={
          <>
            <Button onClick={() => retry()}>Try again</Button>
            <LinkButton href="/" variant="outline">
              Back to home
            </LinkButton>
          </>
        }
      />
    </>
  );
}
