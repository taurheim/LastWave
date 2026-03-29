import { useState, useEffect } from 'react';
import { useLastWaveStore } from '@/store/index';
import { fetchWithRetry } from '@/core/fetchWithRetry';

const IMAGES_PER_PAGE = 9;
const GALLERY_API_URL = 'https://res.cloudinary.com/lastwave/image/list/browser_upload.json';

export default function GalleryBrowser() {
  const [allImages, setAllImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const addToast = useLastWaveStore((s) => s.addToast);

  useEffect(() => {
    fetchWithRetry(GALLERY_API_URL)
      .then((res) => res.json() as Promise<{ resources?: Array<{ public_id: string }> }>)
      .then((data) => {
        const images = (data.resources ?? []).map(
          (r) => `https://res.cloudinary.com/lastwave/image/upload/${r.public_id}.png`,
        );
        setAllImages(images);
      })
      .catch(() => {
        setLoadError(true);
        addToast('Could not load the gallery. Please try refreshing the page.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const pageCount = Math.max(1, Math.ceil(allImages.length / IMAGES_PER_PAGE));
  const firstImage = currentPage * IMAGES_PER_PAGE;
  const thisPageImages = allImages.slice(firstImage, firstImage + IMAGES_PER_PAGE);

  return (
    <div className="px-4 py-6 text-center">
      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-16" data-testid="gallery-spinner">
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-lw-border border-t-lw-accent" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && loadError && (
        <div className="py-12">
          <p className="mb-2 text-sm text-lw-muted">Could not load gallery images.</p>
          <p className="text-xs text-lw-muted/60">
            Please try refreshing, or report this at{' '}
            <a href="mailto:niko@savas.ca" className="text-lw-accent hover:underline">
              niko@savas.ca
            </a>
            {' / '}
            <a
              href="https://github.com/nikosavas/LastWave/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lw-accent hover:underline"
            >
              GitHub Issues
            </a>
            .
          </p>
        </div>
      )}

      {/* Navigation */}
      {!isLoading && !loadError && (
        <div className="mb-6 flex justify-center gap-3">
          <button
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="rounded-lg border border-lw-border px-5 py-2 text-xs uppercase tracking-wider text-lw-text transition-all hover:border-lw-accent hover:text-lw-accent disabled:cursor-not-allowed disabled:border-lw-border/30 disabled:text-lw-muted/30"
          >
            ← Previous
          </button>
          <button
            disabled={currentPage >= pageCount - 1}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="rounded-lg border border-lw-border px-5 py-2 text-xs uppercase tracking-wider text-lw-text transition-all hover:border-lw-accent hover:text-lw-accent disabled:cursor-not-allowed disabled:border-lw-border/30 disabled:text-lw-muted/30"
          >
            Next →
          </button>
        </div>
      )}

      {/* Image Grid */}
      {!isLoading && !loadError && (
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-3">
          {thisPageImages.map((url, i) => (
            <div
              key={`${currentPage}-${i}`}
              onClick={() => setLightboxUrl(url)}
              className="h-[160px] w-[220px] cursor-pointer rounded-lg border border-lw-border bg-cover bg-center bg-no-repeat transition-all duration-200 hover:border-lw-accent hover:shadow-[0_0_16px_rgba(39,170,225,0.15)]"
              style={{ backgroundImage: `url(${url})` }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {!isLoading && !loadError && (
        <p className="mt-6 text-xs uppercase tracking-widest text-lw-muted">
          Page {currentPage + 1} / {pageCount}
        </p>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Gallery image"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
