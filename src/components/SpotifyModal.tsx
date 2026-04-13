import { useState, useEffect } from 'react';

type SetupGuide = 'both' | 'lastfm' | 'listenbrainz';

interface SpotifyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SpotifyModal({ open, onClose }: SpotifyModalProps) {
  const [guide, setGuide] = useState<SetupGuide>('both');

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-4 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-lw-border bg-lw-bg p-6 text-left shadow-2xl sm:p-8">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-lw-muted transition-colors hover:bg-lw-accent/10 hover:text-lw-text"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <h2 className="mb-4 pr-8 text-xl font-bold text-lw-text sm:text-2xl">
          I want to see stats for my Spotify listening history!
        </h2>

        <p className="mb-6 text-sm leading-relaxed text-lw-muted sm:text-base">
          Unfortunately, Spotify does not expose a public API to access your music listening history.
          To use LastWave (and{' '}
          <a
            href="https://www.reddit.com/r/lastfm/comments/htzomy/list_of_spotifylastfm_stats_websites_and_not_just/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lw-accent underline decoration-lw-accent/30 transition-colors hover:decoration-lw-accent"
          >
            many more visualization tools
          </a>
          ), you will need to set up last.fm and/or ListenBrainz.
        </p>

        {/* Section heading */}
        <h3 className="mb-2 text-lg font-semibold text-lw-text">Set up last.fm and ListenBrainz</h3>

        {/* Why both? */}
        <div className="mb-5 rounded-lg border border-lw-border bg-lw-surface/50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-lw-text">Why both?</h4>
          <p className="text-xs leading-relaxed text-lw-muted sm:text-sm">
            An important limitation of last.fm is that you cannot update your listening history past 2
            weeks ago. This means that even though you have your full listening history, you can only
            actually upload the last 2 weeks of it to last.fm. ListenBrainz is an open source
            MetaBrainz project that is less popular but has more flexibility. LastWave supports both,
            but many other tools may only support last.fm.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-lw-muted sm:text-sm">
            My recommendation is to set up both for maximum flexibility, but you can always choose one
            or the other as you prefer.
          </p>
        </div>

        {/* Guide toggle */}
        <div className="mb-5 flex items-center justify-center gap-1 rounded-lg border border-lw-border bg-lw-surface/50 p-1">
          {([
            { key: 'both' as SetupGuide, label: 'Both (Recommended)' },
            { key: 'lastfm' as SetupGuide, label: 'Last.fm only' },
            { key: 'listenbrainz' as SetupGuide, label: 'ListenBrainz only' },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setGuide(opt.key)}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                guide === opt.key
                  ? 'bg-lw-accent text-lw-bg shadow-sm'
                  : 'text-lw-muted hover:text-lw-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Instructions */}
        <ol className="list-decimal space-y-2.5 pl-5 text-sm text-lw-text">
          {guide !== 'listenbrainz' && (
            <li>
              <a
                href="https://www.last.fm/join"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lw-accent underline decoration-lw-accent/30 transition-colors hover:decoration-lw-accent"
              >
                Create a last.fm account
              </a>
            </li>
          )}
          {guide !== 'lastfm' && (
            <li>
              <a
                href="https://musicbrainz.org/register"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lw-accent underline decoration-lw-accent/30 transition-colors hover:decoration-lw-accent"
              >
                Create a ListenBrainz account
              </a>
            </li>
          )}
          {guide !== 'listenbrainz' && (
            <li>
              <a
                href="https://www.last.fm/settings/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lw-accent underline decoration-lw-accent/30 transition-colors hover:decoration-lw-accent"
              >
                Connect &ldquo;Spotify Scrobbling&rdquo; to last.fm
              </a>
            </li>
          )}
          {guide !== 'lastfm' && (
            <li>
              <a
                href="https://listenbrainz.org/settings/music-services/details/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lw-accent underline decoration-lw-accent/30 transition-colors hover:decoration-lw-accent"
              >
                &ldquo;Record Spotify Listening History&rdquo; in ListenBrainz
              </a>
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
