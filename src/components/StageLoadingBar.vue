<template>
  <div>
    {{ currentStage.stageName }} : {{ currentStage.currentSegment }} / {{ currentStage.stageSegments }}
    <md-progress-bar md-mode="determinate" :md-value="currentPercentComplete">
    </md-progress-bar>
  </div>
</template>
<script lang="ts">
import Vue from 'vue';
import store from '@/store';
import LoadingStage from '@/models/LoadingStage';
export default Vue.extend({
  computed: {
    currentStage(): LoadingStage | {} {
      // TODO this could be done prettier
      if (store.state.currentStage !== -1) {
        return store.state.stages[store.state.currentStage];
      } else {
        return {};
      }
    },
    currentPercentComplete() {
      const currentStageIndex = store.state.currentStage;
      if (currentStageIndex === -1) {
        return 0;
      }

      let currentPercent = 0;

      // Add all completed stages
      for (let i = 0; i < currentStageIndex; i++) {
        currentPercent += store.state.stages[i].stageWeight;
      }

      // Show how far into the current stage we are
      const currentStage: LoadingStage = store.state.stages[currentStageIndex];
      const currentStageProgress = currentStage.currentSegment / currentStage.stageSegments;
      currentPercent += Math.floor(currentStageProgress * currentStage.stageWeight);
      return currentPercent;
    },
  },
});
</script>
