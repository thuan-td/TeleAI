import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AgentConfigUnavailableError,
  fetchAgentConfig,
  fetchVoices,
  updateAgentConfig,
  type AgentConfigResponse,
  type AgentConfigSaveResult,
  type VoiceOption,
} from "../api/agentConfig";
import { BehaviorSliders } from "../components/agent/BehaviorSliders";
import { LanguagePicker } from "../components/agent/LanguagePicker";
import { OpenAIRealtimeConfig } from "../components/agent/OpenAIRealtimeConfig";
import { PromptEditor } from "../components/agent/PromptEditor";
import { SaveResultBanner } from "../components/agent/SaveResultBanner";
import { SystemIntentThreshold } from "../components/agent/SystemIntentThreshold";
import { VoicePicker } from "../components/agent/VoicePicker";

type ProviderTab = "retell" | "openai";

interface FormState {
  general_prompt: string;
  begin_message: string;
  voice_id: string;
  language: string;
  responsiveness: number;
  interruption_sensitivity: number;
  intent_confidence_threshold: number;
  openai_realtime_language: string;
  openai_realtime_prompt: string;
  openai_realtime_voice: string;
}

function toFormState(config: AgentConfigResponse): FormState {
  return {
    general_prompt: config.general_prompt ?? "",
    begin_message: config.begin_message ?? "",
    voice_id: config.voice_id,
    language: Array.isArray(config.language) ? (config.language[0] ?? "en-US") : config.language,
    responsiveness: config.responsiveness ?? 1,
    interruption_sensitivity: config.interruption_sensitivity ?? 1,
    intent_confidence_threshold: config.intent_confidence_threshold,
    openai_realtime_language: config.openai_realtime_language,
    openai_realtime_prompt: config.openai_realtime_prompt,
    openai_realtime_voice: config.openai_realtime_voice,
  };
}

export function AgentConfigPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProviderTab>("retell");
  const [config, setConfig] = useState<AgentConfigResponse | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<AgentConfigSaveResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setUnavailableMessage(null);
    setLoadError(null);
    Promise.all([fetchAgentConfig(), fetchVoices()])
      .then(([configResponse, voicesResponse]) => {
        setConfig(configResponse);
        setVoices(voicesResponse);
        setForm(toFormState(configResponse));
      })
      .catch((err: unknown) => {
        if (err instanceof AgentConfigUnavailableError) {
          setUnavailableMessage(err.message);
        } else {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (!config || !form) return false;
    const original = toFormState(config);
    return (Object.keys(form) as (keyof FormState)[]).some((key) => form[key] !== original[key]);
  }, [config, form]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!form || !config) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveResult(null);
    try {
      const result = await updateAgentConfig({
        general_prompt: form.general_prompt,
        begin_message: form.begin_message,
        voice_id: form.voice_id,
        language: form.language,
        responsiveness: form.responsiveness,
        interruption_sensitivity: form.interruption_sensitivity,
        intent_confidence_threshold: form.intent_confidence_threshold,
        openai_realtime_language: form.openai_realtime_language,
        openai_realtime_prompt: form.openai_realtime_prompt,
        openai_realtime_voice: form.openai_realtime_voice,
        publish: true,
      });
      setSaveResult(result);
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">{t("agentConfig.loading")}</p>;
  }

  if (unavailableMessage) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {unavailableMessage}
      </div>
    );
  }

  if (loadError || !config || !form) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
        {t("agentConfig.loadError", { message: loadError ?? t("common.unknownError") })}
      </p>
    );
  }

  const tabs: { key: ProviderTab; label: string }[] = [
    { key: "retell", label: t("agentConfig.tabs.retell") },
    { key: "openai", label: t("agentConfig.tabs.openai") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("agentConfig.title")}</h1>
          {activeTab === "retell" && (
            <p className="text-sm text-slate-500">
              {t("agentConfig.metaLine", {
                name: config.agent_name ?? config.agent_id,
                version: config.version,
                publishStatus: config.is_published ? t("agentConfig.published") : t("agentConfig.notPublished"),
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? t("agentConfig.saving") : t("agentConfig.saveButton")}
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? "border-b-2 border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600"
                : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SaveResultBanner saveError={saveError} saveResult={saveResult} />

      {activeTab === "retell" && (
        <>
          {config.llm_id === null && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {t("agentConfig.customLlmNotice")}
            </p>
          )}

          <PromptEditor
            generalPrompt={form.general_prompt}
            beginMessage={form.begin_message}
            disabled={config.llm_id === null}
            onGeneralPromptChange={(v) => updateField("general_prompt", v)}
            onBeginMessageChange={(v) => updateField("begin_message", v)}
          />

          <VoicePicker
            voices={voices}
            selectedVoiceId={form.voice_id}
            disabled={false}
            onSelect={(v) => updateField("voice_id", v)}
          />

          <LanguagePicker language={form.language} onLanguageChange={(v) => updateField("language", v)} />

          <BehaviorSliders
            responsiveness={form.responsiveness}
            interruptionSensitivity={form.interruption_sensitivity}
            disabled={false}
            onResponsivenessChange={(v) => updateField("responsiveness", v)}
            onInterruptionSensitivityChange={(v) => updateField("interruption_sensitivity", v)}
          />

          <SystemIntentThreshold
            value={form.intent_confidence_threshold}
            onChange={(v) => updateField("intent_confidence_threshold", v)}
          />
        </>
      )}

      {activeTab === "openai" && (
        <OpenAIRealtimeConfig
          language={form.openai_realtime_language}
          onLanguageChange={(v) => updateField("openai_realtime_language", v)}
          prompt={form.openai_realtime_prompt}
          onPromptChange={(v) => updateField("openai_realtime_prompt", v)}
          voice={form.openai_realtime_voice}
          onVoiceChange={(v) => updateField("openai_realtime_voice", v)}
        />
      )}
    </div>
  );
}
