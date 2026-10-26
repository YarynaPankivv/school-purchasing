// 404 для адрес, яких у застосунку немає (і для notFound() поза авторизованою частиною): без бічної панелі.
import { LinkButton, StatusPage } from "@/components/ui";

export default function NotFound() {
  return (
    <StatusPage
      standalone
      icon="search"
      code="404"
      title="Page not found"
      description="This address does not exist. Check the link or go back to the start."
      actions={<LinkButton href="/">Back to home</LinkButton>}
    />
  );
}
