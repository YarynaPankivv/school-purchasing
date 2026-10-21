import { Alert, Field, inputClass } from "@/app/_components/ui";
import { Icon } from "@/app/_components/icons";
import { SubmitButton } from "@/app/_components/submit-button";
import { login } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "Incorrect email or password.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary text-primary-ink shadow-card">
          <Icon name="file-plus" className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">School Purchasing</h1>
          <p className="text-sm text-muted">Sign in to submit and approve purchase requests.</p>
        </div>
      </div>

      <form action={login} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-card">
        <Alert message={message} />
        <Field label="Email">
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@example.test"
            className={inputClass}
          />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </form>
    </main>
  );
}
