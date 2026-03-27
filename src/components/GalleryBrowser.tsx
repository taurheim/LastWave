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
      .then((res) => res.json())
      .then((data) => {
        const images = (data.resources ?? []).map(
          (r: { public_id: string }) =>
            `https://res.cloudinary.com/lastwave/image/upload/${r.public_id}.png`,
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
    <div className="text-center py-6 px-4">
      {/* Loading state */}
      {isLoading && (
        <div className="py-16 flex justify-center" data-testid="gallery-spinner">
          <div className="w-11 h-11 border-[3px] border-lw-border border-t-lw-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && loadError && (
        <div className="py-12">
          <p className="text-lw-muted text-sm mb-2">Could not load gallery images.</p>
          <p className="text-lw-muted/60 text-xs">
            Please try refreshing, or report this at{' '}
            <a href="mailto:niko@savas.ca" className="text-lw-accent hover:underline">niko@savas.ca</a>
            {' / '}
            <a href="https://github.com/nikosavas/LastWave/issues/new" target="_blank" rel="noopener noreferrer" className="text-lw-accent hover:underline">GitHub Issues</a>.
          </p>
        </div>
      )}

      {/* Navigation */}
      {!isLoading && !loadError && <div className="flex justify-center gap-3 mb-6">
        <button
          disabled={currentPage === 0}
          onClick={() => setCurrentPage((p) => p - 1)}
          className="border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent disabled:border-lw-border/30 disabled:text-lw-muted/30 disabled:cursor-not-allowed rounded-lg px-5 py-2 text-xs tracking-wider uppercase transition-all"
        >
          ← Previous
        </button>
        <button
          disabled={currentPage >= pageCount - 1}
          onClick={() => setCurrentPage((p) => p + 1)}
          className="border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent disabled:border-lw-border/30 disabled:text-lw-muted/30 disabled:cursor-not-allowed rounded-lg px-5 py-2 text-xs tracking-wider uppercase transition-all"
        >
          Next →
        </button>
      </div>}

      {/* Image Grid */}
      {!isLoading && !loadError && <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
        {thisPageImages.map((url, i) => (
          <div
            key={`${currentPage}-${i}`}
            onClick={() => setLightboxUrl(url)}
            className="w-[220px] h-[160px] bg-cover bg-center bg-no-repeat rounded-lg border border-lw-border cursor-pointer hover:border-lw-accent hover:shadow-[0_0_16px_rgba(39,170,225,0.15)] transition-all duration-200"
            style={{ backgroundImage: `url(${url})` }}
          />
        ))}
      </div>}

      {/* Footer */}
      {!isLoading && !loadError && <p className="mt-6 text-xs tracking-widest uppercase text-lw-muted">
        Page {currentPage + 1} / {pageCount}
      </p>}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Gallery image"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
