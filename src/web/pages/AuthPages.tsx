import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Logo } from "../components/Logo.tsx";
import { ThemeToggle } from "../components/ThemeToggle.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Input } from "../components/ui/input.tsx";
import { Field } from "../components/ui/label.tsx";
import { api, errorMessage } from "../lib/api.ts";
import { useT } from "../lib/i18n.tsx";
import { useConfig } from "../lib/queries.ts";

function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  const { data: config } = useConfig();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="fixed top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <Logo className="size-8" />
        {config?.appName ?? "Cabas"}
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
      {footer && <div className="text-muted-foreground mt-4 text-sm">{footer}</div>}
    </div>
  );
}

function useAuthSubmit(url: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body: object) => api.post(url, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
  });
}

export function LoginPage() {
  const t = useT();
  const { data: config } = useConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useAuthSubmit("/auth/login");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <AuthShell
      title={t("auth.loginTitle")}
      description={t("auth.loginHint")}
      footer={
        config?.allowSignup && (
          <>
            {t("auth.noAccount")}{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              {t("auth.signup")}
            </Link>
          </>
        )
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t("auth.email")}>
          {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={t("auth.password")}>
          {(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        {login.error && <p className="text-destructive text-sm">{errorMessage(login.error, t("common.error"))}</p>}
        <Button type="submit" className="w-full" loading={login.isPending}>
          {t("auth.login")}
        </Button>
      </form>
    </AuthShell>
  );
}

/** Inscription libre (si ALLOW_SIGNUP) ou via un lien d'invitation /invite/:token */
export function SignupPage() {
  const t = useT();
  const { token } = useParams();
  const { data: config } = useConfig();
  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api.get<{ householdName: string; role: string; email: string | null }>(`/invitations/${token}`),
    enabled: !!token,
    retry: false,
  });
  const [form, setForm] = useState({ displayName: "", email: "", password: "", householdName: "" });
  const signup = useAuthSubmit("/auth/signup");
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const backToLogin = (
    <Link to="/login" className="text-primary font-medium hover:underline">
      {t("auth.haveAccount")}
    </Link>
  );

  if (token && invitation.isError) return <AuthShell title={t("auth.inviteInvalid")} description={t("auth.inviteInvalidHint")} footer={backToLogin} />;
  if (!token && config && !config.allowSignup) return <AuthShell title={t("auth.signupClosed")} description={t("auth.signupClosedHint")} footer={backToLogin} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signup.mutate(token ? { ...form, householdName: undefined, inviteToken: token } : form);
  };

  return (
    <AuthShell
      title={token ? t("auth.joinTitle", { name: invitation.data?.householdName ?? "…" }) : t("auth.signupTitle")}
      description={token ? t("auth.joinHint") : t("auth.signupHint")}
      footer={backToLogin}
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label={t("member.displayName")}>
          {(id) => <Input id={id} required maxLength={40} value={form.displayName} onChange={(e) => set("displayName")(e.target.value)} />}
        </Field>
        <Field label={t("auth.email")}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              required
              placeholder={invitation.data?.email ?? undefined}
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
            />
          )}
        </Field>
        <Field label={t("auth.password")} hint={t("auth.passwordHint")}>
          {(id) => (
            <Input id={id} type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={(e) => set("password")(e.target.value)} />
          )}
        </Field>
        {!token && (
          <Field label={t("household.name")}>
            {(id) => (
              <Input
                id={id}
                required
                placeholder={t("household.namePlaceholder")}
                value={form.householdName}
                onChange={(e) => set("householdName")(e.target.value)}
              />
            )}
          </Field>
        )}
        {signup.error && <p className="text-destructive text-sm">{errorMessage(signup.error, t("common.error"))}</p>}
        <Button type="submit" className="w-full" loading={signup.isPending}>
          {token ? t("auth.join") : t("auth.signup")}
        </Button>
      </form>
    </AuthShell>
  );
}
