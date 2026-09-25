import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VoiceOption } from "../../api/agentConfig";
import { TextInput } from "../ui/TextInput";

interface VoicePickerProps {
  voices: VoiceOption[];
  selectedVoiceId: string;
  disabled: boolean;
  onSelect: (voiceId: string) => void;
}

const JAPANESE_HINTS = ["ja", "japan", "nhật"];

function isJapaneseVoice(voice: VoiceOption): boolean {
  const haystack = `${voice.accent ?? ""} ${voice.voice_name}`.toLowerCase();
  return JAPANESE_HINTS.some((hint) => haystack.includes(hint));
}

export function VoicePicker({ voices, selectedVoiceId, disabled, onSelect }: VoicePickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const filteredVoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = query
      ? voices.filter((v) =>
          [v.voice_name, v.provider, v.gender, v.accent].some((field) =>
            field?.toLowerCase().includes(query),
          ),
        )
      : voices;

    return [...matched].sort((a, b) => {
      const aJa = isJapaneseVoice(a) ? 0 : 1;
      const bJa = isJapaneseVoice(b) ? 0 : 1;
      return aJa - bJa;
    });
  }, [voices, search]);

  function handlePreview(voice: VoiceOption) {
    if (!voice.preview_audio_url) return;
    const audio = new Audio(voice.preview_audio_url);
    setPlayingId(voice.voice_id);
    audio.play().catch(() => setPlayingId(null));
    audio.onended = () => setPlayingId(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-6">
      <h2 className="text-base font-semibold text-fg">{t("agentConfig.voicePicker.title")}</h2>
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("agentConfig.voicePicker.searchPlaceholder")}
      />
      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1.5">
        {filteredVoices.length === 0 && (
          <li className="px-3 py-2 text-sm text-fg-subtle">{t("agentConfig.voicePicker.empty")}</li>
        )}
        {filteredVoices.map((voice) => {
          const isSelected = voice.voice_id === selectedVoiceId;
          return (
            <li key={voice.voice_id} className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(voice.voice_id)}
                className={
                  isSelected
                    ? "flex-1 rounded-md bg-accent px-3 py-2 text-left text-sm font-medium text-accent-fg disabled:cursor-not-allowed"
                    : "flex-1 rounded-md px-3 py-2 text-left text-sm text-fg-muted hover:bg-surface-sunken disabled:cursor-not-allowed"
                }
              >
                {voice.voice_name}
                <span className="ml-2 text-xs opacity-75">
                  {voice.provider}
                  {voice.gender ? ` · ${voice.gender}` : ""}
                  {voice.accent ? ` · ${voice.accent}` : ""}
                </span>
              </button>
              {voice.preview_audio_url && (
                <button
                  type="button"
                  onClick={() => handlePreview(voice)}
                  title={t("agentConfig.voicePicker.previewTitle")}
                  className="rounded-md border border-border px-2 py-2 text-sm text-fg-muted hover:bg-surface-sunken"
                >
                  {playingId === voice.voice_id ? "⏸" : "▶"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
