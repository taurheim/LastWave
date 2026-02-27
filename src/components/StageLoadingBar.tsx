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
    <div className="w-full max-w-xl mx-auto py-8 px-4">
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
