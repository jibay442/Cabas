import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { Spinner, ToastProvider } from "./components/ui.tsx";
import { I18nProvider, useT } from "./lib/i18n.tsx";
import { useConfig, useMe } from "./lib/queries.ts";
import { applyAccent, applyTheme } from "./lib/theme.ts";
import { LoginPage, SignupPage } from "./pages/AuthPages.tsx";
import { ComingSoon } from "./pages/ComingSoon.tsx";
import { AccountSettings } from "./pages/settings/AccountSettings.tsx";
import { CategoriesSettings, StoresSettings } from "./pages/settings/CatalogSettings.tsx";
import { HouseholdSettings } from "./pages/settings/HouseholdSettings.tsx";
import { MemberEditor } from "./pages/settings/MemberEditor.tsx";
import { MembersSettings } from "./pages/settings/MembersSettings.tsx";
import { SettingsPage } from "./pages/settings/SettingsPage.tsx";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } },
});

function AuthedRoutes() {
  const t = useT();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ComingSoon emoji="🛒" title={t("nav.list")} />} />
        <Route path="tickets" element={<ComingSoon emoji="🧾" title={t("nav.receipts")} />} />
        <Route path="repas" element={<ComingSoon emoji="🍽️" title={t("nav.meals")} />} />
        <Route path="bilan" element={<ComingSoon emoji="📊" title={t("nav.stats")} />} />
        <Route path="reglages">
          <Route index element={<SettingsPage />} />
          <Route path="compte" element={<AccountSettings />} />
          <Route path="foyer" element={<HouseholdSettings />} />
          <Route path="membres" element={<MembersSettings />} />
          <Route path="membres/:id" element={<MemberEditor />} />
          <Route path="rayons" element={<CategoriesSettings />} />
          <Route path="magasins" element={<StoresSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  const { data: config } = useConfig();
  const { data: me, isPending } = useMe();

  useEffect(() => {
    if (me) {
      applyTheme(me.user.theme);
      applyAccent(me.household.accentColor);
    }
  }, [me]);
  useEffect(() => {
    if (config) document.title = config.appName;
  }, [config]);

  const locale = me?.user.locale ?? config?.defaultLocale ?? "fr";

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-accent-ink">
        <Spinner />
      </div>
    );
  }

  return (
    <I18nProvider locale={locale}>
      <ToastProvider>
        {me ? (
          <AuthedRoutes />
        ) : (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/invite/:token" element={<SignupPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        )}
      </ToastProvider>
    </I18nProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
