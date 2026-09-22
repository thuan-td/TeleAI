interface AudioPlayerProps {
  recordingUrl: string | null;
}

export function AudioPlayer({ recordingUrl }: AudioPlayerProps) {
  if (!recordingUrl) {
    return <span className="audio-player-empty">Chưa có recording</span>;
  }
  return <audio controls src={recordingUrl} data-testid="audio-player" />;
}
