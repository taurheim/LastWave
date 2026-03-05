import { useLastWaveStore } from '@/store/index';

interface OptionActionsProps {
  onToggleCustomize: () => void;
  isCustomizeOpen: boolean;
}

export default function OptionActions({ onToggleCustomize, isCustomizeOpen }: OptionActionsProps) {
  const resetToOptions = useLastWaveStore((s) => s.resetToOptions);

  return (
    <div className="flex flex-wrap justify-center gap-3 py-3">
      <button
        onClick={resetToOptions}
        className="border border-lw-border hover:border-lw-muted text-lw-muted hover:text-lw-text rounded-lg px-5 py-2 text-xs tracking-wider uppercase transition-all"
      >
        ← Modify options
      </button>

      <button
        onClick={onToggleCustomize}
        className={`border rounded-lg px-5 py-2 text-xs tracking-wider uppercase transition-all ${
          isCustomizeOpen
            ? 'border-lw-accent text-lw-accent'
            : 'border-lw-border hover:border-lw-muted text-lw-muted hover:text-lw-text'
        }`}
      >
        {isCustomizeOpen ? 'Hide customize' : 'Customize'}
      </button>
    </div>
  );
}
