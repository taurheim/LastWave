<template>
  <div id="lastwave-control">
    <md-dialog-alert
      :md-active.sync="showError"
      :md-content="`Something went wrong:<br><br><span style='font-family: monospace'>${error}</span><br><br>If this is unexpected, please let me know at niko@savas.ca`"
      md-confirm-text="Ok"
      @md-closed="backToOptions"
      @md-clicked-outside="backToOptions"/>
    <!--
      Once more renderers/data sources have been added, use this dropdown
    <div class="viz-select">
      Data Source:
      <select @change="chooseDataSource">
        <option v-for="dataSource in dataSources" v-bind:value="dataSource.title" v-bind:key="dataSource.title">
          {{ dataSource.title }}
        </option>
      </select>
      //
      Renderer: 
      <select>
        <option v-for="renderer in renderers" v-bind:value="renderer.title" v-bind:key="renderer.title">
          {{ renderer.title }}
        </option>
      </select>
    </div>
    -->
    <div id="options" v-show="showOptions">
      <div id="main-options">
        <template v-for="opt in mainOptions">
          <WaveOption :key="opt.title" :option="opt"></WaveOption>
        </template>
      </div>
      <md-button @click="showAdvancedOptions">Advanced Options {{ advancedOptionsIcon }}</md-button>
      <div id="advanced-options" class="md-layout md-gutter" style="display: none;">
        <div class="md-layout-item">
          Data Source Options
          <template v-for="opt in dataSourceOptions">
            <WaveOption v-bind:key="opt.title" v-bind:option="opt" owner="dataSource"></WaveOption>
          </template>
        </div>
        <div class="md-layout-item">
          Renderer Options
          <template v-for="opt in rendererOptions">
            <WaveOption v-bind:key="opt.title" v-bind:option="opt" owner="renderer"></WaveOption>
          </template>
        </div>
      </div>
      <div class="submit">
        <md-button class="md-raised md-primary" v-on:click="createWave">
          Submit
        </md-button>
      </div>
    </div>
    <div id="loading" v-show="showLoadingBar">
      <StageLoadingBar></StageLoadingBar>
    </div>
    <div id="actions" v-show="showActions">
    </div>
    <div id="visualization" v-show="showVisualization">
      <div id="svg-wrapper" :class="(showFullSvg ? '' : 'scaled')">
      </div>
      <div id="visualization-options" v-if="showSvgOptions">
        <md-button class="md-primary" v-on:click="toggleFullSvg">
          {{ showFullSvg ? 'Hide' : 'Show'}} full size
        </md-button>
      </div>
    </div>
  </div>
</template>
<style>
  #lastwave-control {
    text-align: center;
  }
  #options {
    max-width: 1000px;
    margin: 0 auto;
  }
  .md-layout.md-gutter>.md-layout-item {
    max-width: 400px;
    margin: 0 auto;
  }
  #svg-wrapper {
    overflow-x: auto;
  }
  #svg-wrapper svg {
    height: 100%;
  }
  .scaled svg {
    width: 100%;
  }

  /* https://github.com/vuematerial/vue-material/issues/1794 */
  .md-datepicker-dialog.md-theme-default {
    height: 300px !important;
  }

  #advanced-options {
    max-width: 95%;
    margin: 0 auto;
  }
</style>
<script lang="ts">
import Vue from 'vue'
import store from '@/store';
import WaveOption from '@/components/WaveOption.vue';
import LastWaveEngine from '@/lastwave';
import WaveAction from '@/models/WaveAction';
import Option from '@/models/Option';
import Renderer from '@/models/Renderer';
import DataSource from '@/models/DataSource';
import LoadingStage from '@/models/LoadingStage';
import jQuery from 'jquery';
import StageLoadingBar from '@/components/StageLoadingBar.vue';
import MODULE from '@/models/MODULE';

import LastFm from '@/datasources/lastfm';
import WaveGraph from '@/renderers/d3-wave';
import ImageActions from '@/actions/imageActions.vue';
import OptionActions from '@/actions/optionActions.vue';

const ACTIONS_DIV = '#actions';
const ADVANCED_OPTIONS_DIV = '#advanced-options';
const SVG_WRAPPER_DIV = '#svg-wrapper';

export default Vue.extend({
  components: {
    WaveOption,
    StageLoadingBar,
  },
  data() {
    return {
      dataSources: [new LastFm()],
      renderers: [new WaveGraph()],
      actions: [
        OptionActions,
        ImageActions,
      ],
      dataSourceOptions: [],
      rendererOptions: [],
      mainOptions: [],
      advancedOptionsIcon: '+',
      showFullSvg: false,
      showSvgOptions: false,
      liveActionComponents: [] as Vue[],
      showError: false,
      error: null,
    };
  },
  mounted() {
    let dataSourceOptions: Option[] = this.$data.dataSources[0].getOptions();
    let rendererOptions: Option[] = this.$data.renderers[0].getOptions();
    let mainOptions: Option[] = [];

    // Tag all of the options
    dataSourceOptions.forEach((option) => {
      option.module = MODULE.DATA_SOURCE;
    });
    rendererOptions.forEach((option) => {
      option.module = MODULE.RENDERER;
    });

    // Remove all the options that should be in main options
    mainOptions = dataSourceOptions.filter(option => option.isImportant);
    mainOptions = mainOptions.concat(rendererOptions.filter(option => option.isImportant));

    dataSourceOptions = dataSourceOptions.filter(option => !option.isImportant);
    rendererOptions = rendererOptions.filter(option => !option.isImportant);

    this.$data.dataSourceOptions = dataSourceOptions;
    this.$data.rendererOptions = rendererOptions;
    this.$data.mainOptions = mainOptions;

    store.commit('showOptions');
    store.commit('hideLoadingBar');
    store.commit('hideActions');
    store.commit('hideVisualization');
  },
  methods: {
    createWave: function(evnt: any) {
      console.log("Creating wave");

      const engine = new LastWaveEngine();
      const dataSource = this.$data.dataSources[0];
      const dsOptions = store.state.dataSourceOptions;
      const renderer = this.$data.renderers[0];
      const renderOptions = store.state.rendererOptions;

      store.commit('hideOptions');
      store.commit('showLoadingBar');

      engine.CreateWave(dataSource, renderer, dsOptions, renderOptions).then(() => {
        store.commit('hideLoadingBar');
        store.commit('showActions');
        store.commit('showVisualization');
        this.showSvgOptions = true;

        if (!jQuery(ADVANCED_OPTIONS_DIV).is(':visible')) {
          this.showAdvancedOptions();
        }

        // TODO this is definitely not a vue-friendly way of doing this
        // Essentially we need to have a list of actions that get refreshed every time
        // a new wave is created

        // Destroy old actions
        this.liveActionComponents.forEach((component: Vue) => {
          component.$destroy();
        });
        jQuery(ACTIONS_DIV).empty();

        // Add new actions
        this.actions.forEach((action: any) => {
          const newInstance = new action();
          this.liveActionComponents.push(newInstance);
          newInstance.$mount();
          jQuery(ACTIONS_DIV).append(newInstance.$el);
        });
      }).catch((e) => {
        store.commit('log', e);
        this.$data.showError = true;
        this.$data.error = e;
      });
    },
    chooseDataSource: () => {
      return;
    },
    showAdvancedOptions() {
      jQuery(ADVANCED_OPTIONS_DIV).toggle(1000);
      // TODO this should just read from state instead
      this.$data.advancedOptionsIcon = this.$data.advancedOptionsIcon === '+' ? '-' : '+';
    },
    toggleFullSvg() {
      this.$data.showFullSvg = !this.$data.showFullSvg;
    },
    backToOptions() {
      store.commit('showOptions');
      store.commit('hideLoadingBar');
      store.commit('hideActions');
      store.commit('hideVisualization');
    },
  },
  computed: {
    currentStage(): LoadingStage {
      const currentStage: LoadingStage = store.state.stages[store.state.currentStage];
      return currentStage;
    },
    showLoadingBar(): boolean {
      return store.state.showLoadingBar;
    },
    showOptions(): boolean {
      return store.state.showOptions;
    },
    showVisualization(): boolean {
      return store.state.showVisualization;
    },
    showActions(): boolean {
      return store.state.showActions;
    },
  },
});
</script>
