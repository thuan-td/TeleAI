import { useTranslation } from "react-i18next";

interface AudioPlayerProps {
  recordingUrl: string | null;
}

export function AudioPlayer({ recordingUrl }: AudioPlayerProps) {
  const { t } = useTranslation();
  if (!recordingUrl) {
    return <span className="text-sm italic text-fg-subtle">{t("audioPlayer.noRecording")}</span>;
  }
  return <audio controls src={recordingUrl} data-testid="audio-player" className="mt-1 w-full" />;
}
