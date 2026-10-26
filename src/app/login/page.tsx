import { Badge, BrandMark, Icon } from "@/components/ui";
import { login } from "./actions";
import { LoginForm } from "./login-form";

const ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "Incorrect email or password.",
};

// Вхід. Форма — першою в DOM (скрінрідер і Tab починають із неї), ліва панель на lg розташована CSS-сіткою ліворуч.
// Панель розповідає одну історію — як працівник дізнається, що заявку схвалено; усі дані синтетичні (AC-LANG-02:
// усе англійською). На телефоні панель ховається, лишається рядок про сенс продукту над формою.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined;

  return (
    <main className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="flex flex-col justify-start px-5 pb-12 pt-12 sm:px-12 lg:col-start-2 lg:row-start-1 lg:justify-center lg:pt-12">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-3 lg:hidden">
            <BrandMark className="size-11" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold tracking-tight text-foreground">School Purchasing</p>
              <p className="text-sm text-muted-foreground">Submit purchase requests. Approvers decide.</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">Sign in</h1>
            <p className="text-sm text-muted-foreground">Use the account your school created for you.</p>
          </div>

          <LoginForm action={login} message={message} />

          <p className="text-sm text-muted-foreground">
            Accounts are created by your school’s purchasing department. If you cannot sign in, ask them to check your
            account.
          </p>
        </div>
      </section>

      <div
        aria-hidden="true"
        className="relative hidden select-none flex-col items-center justify-center overflow-hidden bg-brand px-12 py-24 text-brand-foreground lg:col-start-1 lg:row-start-1 lg:flex xl:px-16"
      >
        <span className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-brand-foreground/5" />

        <div className="absolute left-12 top-12 flex items-center gap-2.5 font-semibold tracking-tight xl:left-16">
          <BrandMark variant="on-brand" className="size-9" />
          School Purchasing
        </div>

        <div className="relative flex w-full max-w-lg flex-col gap-10">
          <div className="flex max-w-lg flex-col gap-4">
            <p className="text-balance text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
              From request to order, in one place.
            </p>
            <p className="max-w-md text-pretty text-lg text-brand-muted-foreground">
              Staff submit purchases, department heads decide, and the purchasing department takes it from there.
            </p>
          </div>

          <div className="w-full rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold tabular-nums">PUR-1042</span>
              <Badge tone="ok">Approved</Badge>
            </div>
            <p className="mt-2 text-sm font-medium">Art supplies for the spring term</p>
            <p className="text-xs text-muted-foreground">Upper School · 3 lines · $184.00</p>

            <ol className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-tint-sky text-foreground">
                  <Icon name="file-plus" className="size-3.5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">Submitted by Maria D.</span>
                  <span className="text-xs text-muted-foreground">Mon, 9:12 AM</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-status-approved text-status-approved-foreground">
                  <Icon name="check" className="size-3.5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">Approved by Andrii D.</span>
                  <span className="text-xs text-muted-foreground">Mon, 10:42 AM · Head of Upper School</span>
                </span>
              </li>
            </ol>
          </div>
        </div>

      </div>
    </main>
  );
}
