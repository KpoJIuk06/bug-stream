import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@fontsource/golos-text/400.css";
import "@fontsource/golos-text/500.css";
import "@fontsource/golos-text/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./index.css";

import { ApiError } from "./api/client";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Empty, Loading } from "./components/ui";
import { I18nProvider, LocaleKeyed, t } from "./i18n";
import { LoginPage, SetPasswordPage } from "./pages/LoginPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ReportPage } from "./pages/report/ReportPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectPage } from "./pages/ProjectPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminRolesPage } from "./pages/admin/AdminRolesPage";
import { AdminEnvironmentsPage } from "./pages/admin/AdminEnvironmentsPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";
import { AdminJiraPage } from "./pages/admin/AdminJiraPage";
import { ProfilePage } from "./pages/ProfilePage";
import { DashboardPage } from "./pages/DashboardPage";
import { PublicReportPage } from "./pages/PublicReportPage";
import { AdminSlackPage } from "./pages/admin/AdminSlackPage";
import { AdminSignInPage } from "./pages/admin/AdminSignInPage";
import { AdminMailPage } from "./pages/admin/AdminMailPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/** Shows the page only with the permission; the sidebar hides such links anyway. */
function Need({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) return <Empty title={t("You do not have access to this section")} />;
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <LocaleKeyed>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/s/:token" element={<PublicReportPage />} />
                <Route path="/set-password" element={<SetPasswordPage />} />
                <Route
                  element={
                    <RequireAuth>
                      <Layout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="/reports" element={<ReportsPage key="all" view="all" />} />
                  <Route path="/reports/mine" element={<ReportsPage key="mine" view="mine" />} />
                  <Route path="/reports/assigned" element={<ReportsPage key="assigned" view="assigned" />} />
                  <Route path="/reports/:id" element={<ReportPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:id" element={<ProjectPage />} />
                  <Route path="/admin" element={<Need permission="admin.access"><AdminOverviewPage /></Need>} />
                  <Route path="/admin/users" element={<Need permission="user.manage"><AdminUsersPage /></Need>} />
                  <Route path="/admin/roles" element={<Need permission="admin.access"><AdminRolesPage /></Need>} />
                  <Route path="/admin/environments" element={<Need permission="admin.access"><AdminEnvironmentsPage /></Need>} />
                  <Route path="/admin/settings" element={<Need permission="admin.access"><AdminSettingsPage /></Need>} />
                  <Route path="/admin/jira" element={<Need permission="integration.manage"><AdminJiraPage /></Need>} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/admin/slack" element={<Need permission="integration.manage"><AdminSlackPage /></Need>} />
                  <Route path="/admin/sign-in" element={<Need permission="admin.access"><AdminSignInPage /></Need>} />
                  <Route path="/admin/email" element={<Need permission="admin.access"><AdminMailPage /></Need>} />
                  <Route path="/admin/audit" element={<Need permission="audit.view"><AdminAuditPage /></Need>} />
                  <Route path="/users" element={<Navigate to="/admin/users" replace />} />
                  <Route path="*" element={<Empty title={t("Page not found")}>{t("Check the address or go back to the reports.")}</Empty>} />
                </Route>
              </Routes>
            </LocaleKeyed>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
