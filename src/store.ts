import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);
export default new Vuex.Store({
  state: {
    rendererOptions: {},
    dataSourceOptions: {},
  },
  mutations: {
    clearOptions(state) {
      state.rendererOptions = {};
      state.dataSourceOptions = {};
    },
    updateRendererOption(state: any, payload: any) {
      state.rendererOptions[payload.title] = payload.value;
    },
    updateDataSourceOption(state: any, payload:any) {
      state.dataSourceOptions[payload.title] = payload.value;
    }
  },
  actions: {

  },
});
