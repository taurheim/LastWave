import { useState, useEffect } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { useLastWaveStore } from '@/store/appStore';
import { fetchWithRetry } from '@/core/http/fetchWithRetry';
import { packImageSpans, IMAGES_PER_BATCH } from '@/core/gallery/gridSize';
import type { GridSpanClass } from '@/core/gallery/gridSize';

const GALLERY_API_URL = 'https://res.cloudinary.com/lastwave/image/list/browser_upload.json';

interface GalleryImage {
  url: string;
  thumbnailUrl: string;
  spanClass: GridSpanClass;
}

const SPAN_TO_CSS: Record<GridSpanClass, string> = {
  small: '',
  wide: 'col-span-2',
  triple: 'col-span-3',
  full: 'col-span-4',
};

const SPAN_TO_THUMB_WIDTH: Record<GridSpanClass, number> = {
  small: 600,
  wide: 1200,
  triple: 1600,
  full: 2100,
};

export default function GalleryBrowser() {
  const [allImages, setAllImages] = useState<GalleryImage[]>([]);
  const [visibleCount, setVisibleCount] = useState(IMAGES_PER_BATCH);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const addToast = useLastWaveStore((s) => s.addToast);

  useEffect(() => {
    fetchWithRetry(GALLERY_API_URL)
      .then((res) => res.json() as Promise<{
        resources?: Array<{ public_id: string; width?: number; height?: number }>;
      }>)
      .then((data) => {
        const resources = data.resources ?? [];
        const dims = resources.map((r) => ({
          width: r.width ?? 0,
          height: r.height ?? 0,
        }));
        const spans = packImageSpans(dims);
        const images: GalleryImage[] = resources.map((r, i) => {
          const spanClass = spans[i];
          const thumbW = SPAN_TO_THUMB_WIDTH[spanClass];
          return {
            url: `https://res.cloudinary.com/lastwave/image/upload/${r.public_id}.png`,
            thumbnailUrl: `https://res.cloudinary.com/lastwave/image/upload/w_${thumbW}/${r.public_id}.png`,
            spanClass,
          };
        });
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

  const visibleImages = allImages.slice(0, visibleCount);
  const hasMore = visibleCount < allImages.length;

  const lightboxSlides = allImages.map((img) => ({ src: img.url }));

  return (
    <div className="px-4 py-6">
      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-16" data-testid="gallery-spinner">
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-lw-border border-t-lw-accent" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && loadError && (
        <div className="py-12 text-center">
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

      {/* Image Grid */}
      {!isLoading && !loadError && (
        <>
          <div
            className="mx-auto grid max-w-5xl gap-3"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridAutoFlow: 'dense' }}
          >
            {visibleImages.map((img, i) => (
              <div
                key={img.url}
                onClick={() => setLightboxIndex(i)}
                className={`cursor-pointer overflow-hidden rounded-lg border border-lw-border transition-all duration-200 hover:scale-[1.03] hover:border-lw-accent hover:shadow-[0_0_20px_rgba(39,170,225,0.15)] ${SPAN_TO_CSS[img.spanClass]}`}
              >
                <img
                  src={img.thumbnailUrl}
                  alt="LastWave visualization"
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={{ minHeight: '120px' }}
                />
              </div>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setVisibleCount((c) => c + IMAGES_PER_BATCH)}
                className="rounded-lg border border-lw-accent px-6 py-2.5 text-xs uppercase tracking-wider text-lw-accent transition-all hover:bg-lw-accent/10 hover:shadow-[0_0_16px_rgba(39,170,225,0.12)]"
                data-testid="load-more"
              >
                Load More
              </button>
              <p className="mt-2 text-xs text-lw-muted/60">
                Showing {visibleImages.length} of {allImages.length}
              </p>
            </div>
          )}

          {/* All loaded indicator */}
          {!hasMore && allImages.length > 0 && (
            <p className="mt-6 text-center text-xs uppercase tracking-widest text-lw-muted/40">
              {allImages.length} visualizations
            </p>
          )}
        </>
      )}

      {/* Lightbox */}
      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        slides={lightboxSlides}
      />
    </div>
  );
}
