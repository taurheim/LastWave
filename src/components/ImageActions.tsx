import { useState } from 'react';
import { useLastWaveStore } from '@/store/index';
import CloudinaryAPI from '@/core/cloudinary/CloudinaryAPI';
import { fetchWithRetry } from '@/core/fetchWithRetry';

// Fetch Google Fonts CSS, download all referenced font files, and return
// a self-contained <style> block with base64-inlined @font-face rules.
// This is needed because <img>-based SVG rendering blocks external loads.
async function inlineFontCss(fontFamily: string): Promise<string> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, '+')}&display=swap`;
  try {
    // Request woff2 by sending a modern User-Agent
    const cssRes = await fetchWithRetry(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    let css = await cssRes.text();

    // Find all url(...) references and replace with data URIs
    const urlPattern = /url\((https:\/\/[^)]+)\)/g;
    const urls = [...css.matchAll(urlPattern)].map((m) => m[1]);
    for (const fontUrl of urls) {
      try {
        const res = await fetch(fontUrl);
        const buf = await res.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const mime = fontUrl.includes('.woff2') ? 'font/woff2' : 'font/woff';
        css = css.replace(fontUrl, `data:${mime};base64,${b64}`);
      } catch {
        // If a single font file fails, skip it — text will fall back
      }
    }
    return css;
  } catch {
    // If font CSS fetch fails entirely, return empty — SVG will use web font fallback
    return '';
  }
}

// Render an SVG element to a PNG blob with fonts inlined
async function svgToPngBlob(svgEl: SVGSVGElement, fontFamily: string): Promise<Blob> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  // Replace the @import style with fully inlined font CSS
  const styleEl = clone.querySelector('defs style');
  if (styleEl) {
    styleEl.textContent = await inlineFontCss(fontFamily);
  }

  const svgData = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgEl.width.baseVal.value || 800;
      canvas.height = svgEl.height.baseVal.value || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob'));
        }
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ImageActions() {
  const dataSourceOptions = useLastWaveStore((s) => s.dataSourceOptions);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const addToast = useLastWaveStore((s) => s.addToast);

  const [sharingLink, setSharingLink] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [uploadInProgress, setUploadInProgress] = useState(false);

  function getFileName(): string {
    const username = dataSourceOptions.username ?? 'unknown';
    const start =
      dataSourceOptions.time_start instanceof Date && !isNaN(dataSourceOptions.time_start.getTime())
        ? dataSourceOptions.time_start.toLocaleDateString('en-US').replace(/\//g, '-')
        : 'start';
    const end =
      dataSourceOptions.time_end instanceof Date && !isNaN(dataSourceOptions.time_end.getTime())
        ? dataSourceOptions.time_end.toLocaleDateString('en-US').replace(/\//g, '-')
        : 'end';
    return `LastWave_${username}_${start}_${end}`;
  }

  function getSvgElement(): SVGSVGElement | null {
    const wrapper = document.getElementById('svg-wrapper');
    return wrapper?.querySelector('svg') ?? null;
  }

  function downloadSvg() {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getFileName()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadPng() {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const fontFamily = rendererOptions.font ?? 'DM Sans';

    try {
      const blob = await svgToPngBlob(svgEl, fontFamily);
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${getFileName()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
    } catch {
      addToast('PNG download failed. Please try again or use "Download SVG" instead.');
    }
  }

  async function cloudinaryUpload() {
    if (sharingLink) {
      setShowDialog(true);
      return;
    }

    const svgEl = getSvgElement();
    if (!svgEl) return;
    const fontFamily = rendererOptions.font ?? 'DM Sans';

    setUploadInProgress(true);

    try {
      const pngBlob = await svgToPngBlob(svgEl, fontFamily);

      const api = new CloudinaryAPI();
      const imageUrl = await api.uploadImage(
        pngBlob,
        getFileName(),
        rendererOptions.color_scheme ?? 'lastwave',
        dataSourceOptions.username ?? '',
      );

      setSharingLink(imageUrl.replace('.svg', '.png'));
      setShowDialog(true);
    } catch {
      addToast('Could not generate share link. Please try again.');
    } finally {
      setUploadInProgress(false);
    }
  }

  async function nativeShare() {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const fontFamily = rendererOptions.font ?? 'DM Sans';

    try {
      const blob = await svgToPngBlob(svgEl, fontFamily);
      const file = new File([blob], `${getFileName()}.png`, { type: 'image/png' });
      await navigator.share({ files: [file], title: 'LastWave' });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addToast('Share failed. Try downloading the image and sharing it manually.');
      }
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="px-4 py-4 max-lg:landscape:py-2.5">
      {/* Mobile layout — vertical in portrait, horizontal in landscape */}
      <div className="flex flex-col items-center gap-3 lg:hidden max-lg:landscape:flex-row max-lg:landscape:justify-center max-lg:landscape:gap-2">
        {canNativeShare && (
          <button
            onClick={() => {
              void nativeShare();
            }}
            className="w-full max-w-xs rounded-lg bg-gradient-to-r from-lw-accent to-lw-cyan px-6 py-3 text-sm font-semibold uppercase tracking-wider text-lw-bg transition-all hover:shadow-[0_0_20px_rgba(39,170,225,0.25)] max-lg:landscape:order-last max-lg:landscape:ml-auto max-lg:landscape:w-auto max-lg:landscape:py-1.5"
          >
            Share
          </button>
        )}
        <button
          onClick={() => {
            void downloadPng();
          }}
          className={`w-full max-w-xs rounded-lg px-6 py-3 text-sm font-semibold uppercase tracking-wider transition-all max-lg:landscape:w-auto max-lg:landscape:py-1.5 ${
            canNativeShare
              ? 'border border-lw-border text-lw-text hover:border-lw-accent hover:text-lw-accent'
              : 'bg-gradient-to-r from-lw-accent to-lw-cyan text-lw-bg hover:shadow-[0_0_20px_rgba(39,170,225,0.25)]'
          }`}
        >
          Download
        </button>
        <button
          onClick={() => {
            void cloudinaryUpload();
          }}
          className="py-1 text-xs uppercase tracking-wider text-lw-muted transition-colors hover:text-lw-accent max-lg:landscape:px-4"
        >
          {uploadInProgress ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-lw-muted border-t-transparent" />
          ) : (
            'Get share link'
          )}
        </button>
      </div>

      {/* Desktop layout */}
      <div className="hidden items-center justify-center gap-3 lg:flex">
        <button
          onClick={() => {
            void downloadPng();
          }}
          className="rounded-lg bg-gradient-to-r from-lw-accent to-lw-cyan px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-lw-bg transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(39,170,225,0.25)] active:scale-[0.98]"
        >
          Download PNG
        </button>
        <button
          onClick={downloadSvg}
          className="rounded-lg border border-lw-border px-5 py-2.5 text-xs uppercase tracking-wider text-lw-text transition-all hover:border-lw-accent hover:text-lw-accent"
        >
          Download SVG (Vectorized)
        </button>
        <button
          onClick={() => {
            void cloudinaryUpload();
          }}
          className="min-w-[140px] rounded-lg border border-lw-border px-5 py-2.5 text-xs uppercase tracking-wider text-lw-text transition-all hover:border-lw-accent hover:text-lw-accent"
        >
          {uploadInProgress ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-lw-muted border-t-transparent" />
          ) : (
            'Get share link'
          )}
        </button>
      </div>

      {/* Sharing Dialog */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-xl border border-lw-border bg-lw-surface p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 font-display text-xl text-lw-heading">Share this wave</h3>
            <input
              type="text"
              readOnly
              value={sharingLink}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="mb-4 w-full rounded-lg border border-lw-border bg-lw-bg px-4 py-2.5 text-sm text-lw-text focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <a
                href={sharingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-lw-accent transition-colors hover:text-lw-cyan"
              >
                Open link ↗
              </a>
              <button
                onClick={() => setShowDialog(false)}
                className="text-sm text-lw-muted transition-colors hover:text-lw-text"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
