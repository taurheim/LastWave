import { useState } from 'react';
import { useLastWaveStore } from '@/store/index';
import CloudinaryAPI from '@/core/cloudinary/CloudinaryAPI';

// Fetch Google Fonts CSS, download all referenced font files, and return
// a self-contained <style> block with base64-inlined @font-face rules.
// This is needed because <img>-based SVG rendering blocks external loads.
async function inlineFontCss(fontFamily: string): Promise<string> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, '+')}&display=swap`;
  // Request woff2 by sending a modern User-Agent
  const cssRes = await fetch(cssUrl, {
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
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        blob ? resolve(blob) : reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ImageActions() {
  const dataSourceOptions = useLastWaveStore((s) => s.dataSourceOptions);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);

  const [sharingLink, setSharingLink] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [uploadInProgress, setUploadInProgress] = useState(false);

  function getFileName(): string {
    const username = dataSourceOptions.username ?? 'unknown';
    const start = dataSourceOptions.time_start instanceof Date
      ? dataSourceOptions.time_start.toLocaleDateString('en-US').replace(/\//g, '-')
      : 'start';
    const end = dataSourceOptions.time_end instanceof Date
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
    } catch (err) {
      console.error('PNG download failed', err);
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
    } catch (err) {
      console.error('Cloudinary upload failed', err);
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
      // User cancelled or share failed — fall back to download
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed', err);
      }
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="py-4 px-4">
      {/* Mobile layout */}
      <div className="flex flex-col items-center gap-3 md:hidden">
        {canNativeShare && (
          <button
            onClick={nativeShare}
            className="w-full max-w-xs bg-gradient-to-r from-lw-accent to-lw-cyan text-lw-bg rounded-lg px-6 py-3 text-sm tracking-wider uppercase font-semibold transition-all hover:shadow-[0_0_20px_rgba(39,170,225,0.25)]"
          >
            Share
          </button>
        )}
        <button
          onClick={downloadPng}
          className={`w-full max-w-xs rounded-lg px-6 py-3 text-sm tracking-wider uppercase font-semibold transition-all ${
            canNativeShare
              ? 'border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent'
              : 'bg-gradient-to-r from-lw-accent to-lw-cyan text-lw-bg hover:shadow-[0_0_20px_rgba(39,170,225,0.25)]'
          }`}
        >
          Download
        </button>
        <button
          onClick={cloudinaryUpload}
          className="text-lw-muted hover:text-lw-accent text-xs tracking-wider uppercase transition-colors py-1"
        >
          {uploadInProgress ? (
            <span className="inline-block w-4 h-4 border-2 border-lw-muted border-t-transparent rounded-full animate-spin" />
          ) : (
            'Get share link'
          )}
        </button>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex justify-center items-center gap-3">
        <button
          onClick={downloadPng}
          className="bg-gradient-to-r from-lw-accent to-lw-cyan text-lw-bg rounded-lg px-6 py-2.5 text-xs tracking-wider uppercase font-semibold transition-all hover:shadow-[0_0_20px_rgba(39,170,225,0.25)] hover:scale-[1.02] active:scale-[0.98]"
        >
          Download PNG
        </button>
        <button
          onClick={downloadSvg}
          className="border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent rounded-lg px-5 py-2.5 text-xs tracking-wider uppercase transition-all"
        >
          Download SVG (Vectorized)
        </button>
        <button
          onClick={cloudinaryUpload}
          className="border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent rounded-lg px-5 py-2.5 text-xs tracking-wider uppercase transition-all min-w-[140px]"
        >
          {uploadInProgress ? (
            <span className="inline-block w-4 h-4 border-2 border-lw-muted border-t-transparent rounded-full animate-spin" />
          ) : (
            'Get share link'
          )}
        </button>
      </div>

      {/* Sharing Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDialog(false)}>
          <div className="bg-lw-surface border border-lw-border rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-white mb-4">Share this wave</h3>
            <input
              type="text"
              readOnly
              value={sharingLink}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full bg-lw-bg border border-lw-border rounded-lg px-4 py-2.5 mb-4 text-sm text-lw-text focus:outline-none"
            />
            <div className="flex justify-between items-center">
              <a href={sharingLink} target="_blank" rel="noopener noreferrer" className="text-lw-accent hover:text-lw-cyan text-sm transition-colors">
                Open link ↗
              </a>
              <button onClick={() => setShowDialog(false)} className="text-lw-muted hover:text-lw-text text-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
