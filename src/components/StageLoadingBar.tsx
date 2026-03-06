import { useLastWaveStore } from '@/store/index';

export default function StageLoadingBar() {
  const stages = useLastWaveStore((s) => s.stages);
  const currentStageIndex = useLastWaveStore((s) => s.currentStage);

  if (currentStageIndex === -1 || !stages[currentStageIndex]) {
    return null;
  }

  const currentStage = stages[currentStageIndex];

  // Calculate overall percent complete
  let percent = 0;
  for (let i = 0; i < currentStageIndex; i++) {
    percent += stages[i].stageWeight;
  }
  const stageProgress = currentStage.stageSegments > 0
    ? currentStage.currentSegment / currentStage.stageSegments
    : 0;
  percent += Math.floor(stageProgress * currentStage.stageWeight);

  return (
    <div className="w-full max-w-xl mx-auto py-8 px-4 flex flex-col items-center">
      {/* Animated wave spinner */}
      <svg width="48" height="32" viewBox="0 0 48 32" className="mb-4 opacity-60">
        <path fill="rgb(var(--lw-accent))" fillOpacity="0.4">
          <animate attributeName="d" dur="1.8s" repeatCount="indefinite" values="
            M0 12 Q6 6 12 12 Q18 18 24 12 Q30 6 36 12 Q42 18 48 12 L48 20 Q42 26 36 20 Q30 14 24 20 Q18 26 12 20 Q6 14 0 20Z;
            M0 12 Q6 18 12 12 Q18 6 24 12 Q30 18 36 12 Q42 6 48 12 L48 20 Q42 14 36 20 Q30 26 24 20 Q18 14 12 20 Q6 26 0 20Z;
            M0 12 Q6 6 12 12 Q18 18 24 12 Q30 6 36 12 Q42 18 48 12 L48 20 Q42 26 36 20 Q30 14 24 20 Q18 26 12 20 Q6 14 0 20Z
          "/>
        </path>
        <path fill="rgb(var(--lw-cyan))" fillOpacity="0.6">
          <animate attributeName="d" dur="1.8s" repeatCount="indefinite" values="
            M0 14 Q6 10 12 14 Q18 18 24 14 Q30 10 36 14 Q42 18 48 14 L48 18 Q42 22 36 18 Q30 14 24 18 Q18 22 12 18 Q6 14 0 18Z;
            M0 14 Q6 18 12 14 Q18 10 24 14 Q30 18 36 14 Q42 10 48 14 L48 18 Q42 14 36 18 Q30 22 24 18 Q18 14 12 18 Q6 22 0 18Z;
            M0 14 Q6 10 12 14 Q18 18 24 14 Q30 10 36 14 Q42 18 48 14 L48 18 Q42 22 36 18 Q30 14 24 18 Q18 22 12 18 Q6 14 0 18Z
          "/>
        </path>
      </svg>
      <p className="text-center mb-3 text-xs tracking-widest uppercase text-lw-muted">
        {currentStage.stageName} &middot; {currentStage.currentSegment} / {currentStage.stageSegments}
      </p>
      <div className="w-full bg-lw-surface border border-lw-border rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lw-accent to-lw-cyan transition-all duration-300"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
