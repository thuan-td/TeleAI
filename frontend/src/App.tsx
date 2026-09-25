import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildExportUrl, fetchCallDetail, fetchCalls, type CallDetail as CallDetailData, type PaginatedCalls } from "./api/calls";
import type { CurrentUser } from "./api/client";
import { useCurrentUser } from "./auth/useCurrentUser";
import { AppLayout } from "./components/AppLayout";
import { CallDetail } from "./components/CallDetail";
import { CallFilters, type CallFiltersValue } from "./components/calls/CallFilters";
import { CallList } from "./components/CallList";
import { OpenAIWebCallTester } from "./components/OpenAIWebCallTester";
import { Pagination } from "./components/Pagination";
import { WebCallTester } from "./components/WebCallTester";
import { AgentConfigPage } from "./pages/AgentConfigPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";

function App() {
  if (window.location.pathname === "/login") {
    return <LoginPage />;
  }

  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return null;
  }
  if (user === null) {
    // apiFetch already triggers the redirect on 401; this is just the brief
    // render gap before navigation actually happens.
    return null;
  }

  if (window.location.pathname === "/leads") {
    return (
      <AppLayout user={user}>
        <LeadsPage />
      </AppLayout>
    );
  }
  if (window.location.pathname === "/agent-config") {
    return (
      <AppLayout user={user}>
        {user.role === "admin" ? <AgentConfigPage /> : <ForbiddenPage />}
      </AppLayout>
    );
  }
  if (window.location.pathname === "/web-call-test") {
    return (
      <AppLayout user={user}>
        {user.role === "admin" ? <WebCallTester /> : <ForbiddenPage />}
      </AppLayout>
    );
  }
  if (window.location.pathname === "/web-call-test-openai") {
    return (
      <AppLayout user={user}>
        {user.role === "admin" ? <OpenAIWebCallTester /> : <ForbiddenPage />}
      </AppLayout>
    );
  }
  return (
    <AppLayout user={user}>
      <CallMonitor user={user} />
    </AppLayout>
  );
}

const EMPTY_CALL_FILTERS: CallFiltersValue = { status: "", leadId: "", dateFrom: "", dateTo: "", q: "" };
const CALLS_PAGE_SIZE = 20;

function CallMonitor({ user }: { user: CurrentUser }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<CallFiltersValue>(EMPTY_CALL_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedCalls | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallDetailData | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters.status, filters.leadId, filters.dateFrom, filters.dateTo]);

  const loadCalls = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchCalls({
      page,
      pageSize: CALLS_PAGE_SIZE,
      status: filters.status || undefined,
      leadId: filters.leadId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      q: debouncedQ || undefined,
    })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [page, filters.status, filters.leadId, filters.dateFrom, filters.dateTo, debouncedQ]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  useEffect(() => {
    if (!selectedCallId) {
      setSelectedCall(null);
      return;
    }
    setIsDetailLoading(true);
    fetchCallDetail(selectedCallId)
      .then(setSelectedCall)
      .catch(() => setSelectedCall(null))
      .finally(() => setIsDetailLoading(false));
  }, [selectedCallId]);

  const exportUrl = buildExportUrl({
    status: filters.status || undefined,
    leadId: filters.leadId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    q: debouncedQ || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("callMonitor.title")}</h1>
        {user.role === "admin" && (
          <a
            href={exportUrl}
            download
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm hover:bg-accent-hover"
          >
            {t("callMonitor.exportCsv")}
          </a>
        )}
      </div>

      <CallFilters value={filters} onChange={setFilters} />

      {error && (
        <p className="rounded-md border border-danger-border bg-danger-surface px-4 py-2 text-sm text-danger-fg">
          {t("callMonitor.loadError", { message: error })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
          <CallList calls={data?.items ?? []} selectedCallId={selectedCallId} onSelect={setSelectedCallId} isLoading={isLoading} />
          {data && data.total > 0 && (
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
          )}
        </div>
        <CallDetail call={selectedCall} isLoading={isDetailLoading} />
      </div>
    </div>
  );
}

function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <p className="rounded-md border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger-fg">
      {t("auth.forbidden")}
    </p>
  );
}

export default App;
