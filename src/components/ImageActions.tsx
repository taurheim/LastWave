import { useState } from 'react';
import { useLastWaveStore } from '@/store/index';
import CloudinaryAPI from '@/core/cloudinary/CloudinaryAPI';

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

  function serializeSvg(): string | null {
    const svgEl = getSvgElement();
    if (!svgEl) return null;
    return new XMLSerializer().serializeToString(svgEl);
  }

  function downloadSvg() {
    const svgData = serializeSvg();
    if (!svgData) return;
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

  function downloadPng() {
    const svgEl = getSvgElement();
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgEl.width.baseVal.value || 800;
      canvas.height = svgEl.height.baseVal.value || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${getFileName()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.src = url;
  }

  async function cloudinaryUpload() {
    if (sharingLink) {
      setShowDialog(true);
      return;
    }

    const svgEl = getSvgElement();
    if (!svgEl) return;

    setUploadInProgress(true);

    try {
      // Render SVG to PNG blob
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
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

  return (
    <div className="flex flex-wrap justify-center gap-3 py-4">
      <button
        onClick={downloadSvg}
        className="border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent rounded-lg px-5 py-2.5 text-xs tracking-wider uppercase transition-all"
      >
        Download SVG
      </button>

      <button
        onClick={downloadPng}
        className="border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent rounded-lg px-5 py-2.5 text-xs tracking-wider uppercase transition-all"
      >
        Download PNG
      </button>

      <button
        onClick={cloudinaryUpload}
        className="bg-gradient-to-r from-lw-accent to-lw-cyan text-lw-bg rounded-lg px-5 py-2.5 text-xs tracking-wider uppercase font-semibold min-w-[140px] transition-all hover:shadow-[0_0_20px_rgba(39,170,225,0.25)]"
      >
        {uploadInProgress ? (
          <span className="inline-block w-4 h-4 border-2 border-lw-bg border-t-transparent rounded-full animate-spin" />
        ) : (
          'Get share link'
        )}
      </button>

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
