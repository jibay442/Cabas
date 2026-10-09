import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { EmojiPicker } from "../components/Pickers.tsx";
import { ThemeToggle } from "../components/ThemeToggle.tsx";
import { Button, Card, Input } from "../components/ui.tsx";
import { api, ApiError } from "../lib/api.ts";
import { useT } from "../lib/i18n.tsx";
import { useConfig } from "../lib/queries.ts";

function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const { data: config } = useConfig();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="fixed right-3 top-3">
        <ThemeToggle />
      </div>
      <div className="mb-6 text-center">
        <div className="text-6xl" aria-hidden>
          🛒
        </div>
        <div className="mt-2 text-3xl font-bold tracking-tight">{config?.appName ?? "Cabas"}</div>
      </div>
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">{subtitle}</p>}
        {children}
      </Card>
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

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

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
    <AuthShell title={t("auth.loginTitle")}>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Input label={t("auth.email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label={t("auth.password")}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {login.error && <p className="text-sm text-red-700 dark:text-red-400">{errorText(login.error, t("common.error"))}</p>}
        <Button type="submit" className="w-full" loading={login.isPending}>
          {t("auth.login")}
        </Button>
      </form>
      {config?.allowSignup && (
        <p className="mt-4 text-center text-sm">
          {t("auth.noAccount")}{" "}
          <Link to="/signup" className="font-medium text-accent-ink underline">
            {t("auth.signup")}
          </Link>
        </p>
      )}
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
  const [form, setForm] = useState({ displayName: "", emoji: "😀", email: "", password: "", householdName: "" });
  const signup = useAuthSubmit("/auth/signup");
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  if (token && invitation.isError) {
    return (
      <AuthShell title={t("auth.inviteInvalid")}>
        <Link to="/login" className="font-medium text-accent-ink underline">
          {t("auth.login")}
        </Link>
      </AuthShell>
    );
  }
  if (!token && config && !config.allowSignup) {
    return (
      <AuthShell title={t("auth.signupClosed")} subtitle={t("auth.signupClosedHint")}>
        <Link to="/login" className="font-medium text-accent-ink underline">
          {t("auth.login")}
        </Link>
      </AuthShell>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signup.mutate(token ? { ...form, householdName: undefined, inviteToken: token } : form);
  };

  return (
    <AuthShell
      title={token ? t("auth.joinTitle", { name: invitation.data?.householdName ?? "…" }) : t("auth.signupTitle")}
      subtitle={token ? t("auth.joinHint") : t("auth.signupHint")}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label={t("member.displayName")} required maxLength={40} value={form.displayName} onChange={(e) => set("displayName")(e.target.value)} />
        <EmojiPicker label={t("member.avatar")} value={form.emoji} onChange={set("emoji")} choices={["😀", "😎", "🤓", "👩", "👨", "🧔", "👱", "👵", "👴", "🦊", "🐻", "🦄"]} />
        <Input
          label={t("auth.email")}
          type="email"
          autoComplete="email"
          required
          value={form.email}
          placeholder={invitation.data?.email ?? undefined}
          onChange={(e) => set("email")(e.target.value)}
        />
        <Input
          label={t("auth.password")}
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint={t("auth.passwordHint")}
          value={form.password}
          onChange={(e) => set("password")(e.target.value)}
        />
        {!token && (
          <Input
            label={t("household.name")}
            required
            placeholder={t("household.namePlaceholder")}
            value={form.householdName}
            onChange={(e) => set("householdName")(e.target.value)}
          />
        )}
        {signup.error && <p className="text-sm text-red-700 dark:text-red-400">{errorText(signup.error, t("common.error"))}</p>}
        <Button type="submit" className="w-full" loading={signup.isPending}>
          {token ? t("auth.join") : t("auth.signup")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-accent-ink underline">
          {t("auth.haveAccount")}
        </Link>
      </p>
    </AuthShell>
  );
}
