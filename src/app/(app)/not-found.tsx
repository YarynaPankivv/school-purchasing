// 404 усередині застосунку (notFound() із заявки, відділу, співробітника): бічна панель і верхня смуга з пошуком лишаються на місці.
import { LinkButton, StatusPage, TopBar } from "@/components/ui";

export default function AppNotFound() {
  return (
    <>
      <TopBar showNewRequest />
      <StatusPage
        icon="search"
        code="404"
        title="Page not found"
        description="This page does not exist, or you do not have access to it."
        actions={
          <>
            <LinkButton href="/requests">Go to requests</LinkButton>
            <LinkButton href="/" variant="outline">
              Back to home
            </LinkButton>
          </>
        }
      />
    </>
  );
}
