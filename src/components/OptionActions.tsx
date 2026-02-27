import { useState } from 'react';
import { useLastWaveStore } from '@/store/index';

export default function OptionActions() {
  const resetToOptions = useLastWaveStore((s) => s.resetToOptions);
  const dataSourceOptions = useLastWaveStore((s) => s.dataSourceOptions);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);

  const [showDialog, setShowDialog] = useState(false);
  const [configString, setConfigString] = useState('');

  function showExportDialog() {
    let config = 'https://savas.ca/lastwave#/?';
    const allOptions: Record<string, any> = { ...rendererOptions, ...dataSourceOptions };

    Object.keys(allOptions).forEach((key) => {
      if (key.startsWith('_')) return; // skip internal keys
      let value = allOptions[key];
      if (value instanceof Date) {
        value = value.getTime();
      }
      if (value !== undefined) {
        config += `${key}=${value}&`;
      }
    });

    setConfigString(encodeURI(config));
    setShowDialog(true);
  }

  return (
    <div className="flex flex-wrap justify-center gap-3 py-3">
      <button
        onClick={resetToOptions}
        className="border border-lw-border hover:border-lw-muted text-lw-muted hover:text-lw-text rounded-lg px-5 py-2 text-xs tracking-wider uppercase transition-all"
      >
        ← Modify options
      </button>

      <button
        onClick={showExportDialog}
        className="border border-lw-border hover:border-lw-muted text-lw-muted hover:text-lw-text rounded-lg px-5 py-2 text-xs tracking-wider uppercase transition-all"
      >
        Export options
      </button>

      {/* Export Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDialog(false)}>
          <div className="bg-lw-surface border border-lw-border rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-white mb-4">Share configuration</h3>
            <input
              type="text"
              readOnly
              value={configString}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full bg-lw-bg border border-lw-border rounded-lg px-4 py-2.5 mb-4 text-sm text-lw-text focus:outline-none"
            />
            <div className="text-right">
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
