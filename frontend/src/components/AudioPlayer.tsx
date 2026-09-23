interface AudioPlayerProps {
  recordingUrl: string | null;
}

export function AudioPlayer({ recordingUrl }: AudioPlayerProps) {
  if (!recordingUrl) {
    return <span className="text-sm italic text-slate-400">Chưa có recording</span>;
  }
  return <audio controls src={recordingUrl} data-testid="audio-player" className="mt-1 w-full" />;
}
