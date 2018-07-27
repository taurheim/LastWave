import Vue from 'vue';
import Vuex from 'vuex';
import LoadingStage from '@/models/LoadingStage';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    // TODO I'm sure there's a better solution for logging. For now we need this
    // to track issues with the beta
    logs: [] as string[],

    rendererOptions: {},
    dataSourceOptions: {},

    // Maybe this should use a state machine instead?
    showOptions: true,
    showLoadingBar: false,
    showActions: false,
    showVisualization: false,

    // Used for loading bars
    currentStage: -1,
    stages: [],
  },
  mutations: {
    setStages(state: any, stages: LoadingStage[]) {
      state.stages = stages;
      state.currentStage = -1;
    },
    startNextStage(state: any, segmentCount: number) {
      state.currentStage++;

      const currentStage: LoadingStage = state.stages[state.currentStage];
      currentStage.currentSegment = 0;
      currentStage.stageSegments = segmentCount;
    },
    progressCurrentStage(state: any) {
      const currentStage: LoadingStage = state.stages[state.currentStage];
      currentStage.currentSegment++;
    },
    showOptions(state: any) {
      state.showOptions = true;
    },
    hideOptions(state: any) {
      state.showOptions = false;
    },
    showLoadingBar(state: any) {
      state.showLoadingBar = true;
    },
    hideLoadingBar(state: any) {
      state.showLoadingBar = false;
    },
    showActions(state: any) {
      state.showActions = true;
    },
    hideActions(state: any) {
      state.showActions = false;
    },
    showVisualization(state: any) {
      state.showVisualization = true;
    },
    hideVisualization(state: any) {
      state.showVisualization = false;
    },
    log(state: any, logString: string) {
      state.logs.push(logString);
    },
  },
  actions: {
  },
});
