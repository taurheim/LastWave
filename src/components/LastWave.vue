<template>
  <div id="lastwave-control">
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
          <WaveOption v-bind:key="opt.title" v-bind:option="opt"></WaveOption>
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
    <div id="visualization">
    </div>
  </div>
</template>
<style>
  #lastwave-control {
    text-align: center;
  }
  #options {
    width: 800px;
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

import LastFm from '@/datasources/lastfm';
import WaveGraph from '@/renderers/d3-wave';
import ImageActions from '@/actions/imageActions.vue';
import ConfigActions from '@/actions/configActions.vue';

export default Vue.extend({
  components: {
    WaveOption,
    StageLoadingBar,
  },
  data() {
    return {
      dataSources: [new LastFm()],
      renderers: [new WaveGraph()],
      actions: [ImageActions, ConfigActions],
      dataSourceOptions: [],
      rendererOptions: [],
      mainOptions: [],
      advancedOptionsIcon: '+',
    };
  },
  mounted() {
    let dataSourceOptions: Option[] = this.$data.dataSources[0].getOptions();
    let rendererOptions: Option[] = this.$data.renderers[0].getOptions();
    let mainOptions: Option[] = [];

    // Tag them
    // TODO this is awful - we shouldn't have to pass around which type of option it is.
    dataSourceOptions.forEach(opt => {
      opt.owner = "dataSource";
    });
    rendererOptions.forEach(opt => {
      opt.owner = "renderer";
    });

    // Remove all the options that should be in main options
    mainOptions = dataSourceOptions.filter(option => option.mainView);
    mainOptions = mainOptions.concat(rendererOptions.filter(option => option.mainView));

    dataSourceOptions = dataSourceOptions.filter(option => !option.mainView);
    rendererOptions = rendererOptions.filter(option => !option.mainView);

    this.$data.dataSourceOptions = dataSourceOptions;
    this.$data.rendererOptions = rendererOptions;
    this.$data.mainOptions = mainOptions;
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
        console.log("BEFORE");
        this.actions.forEach(action => {
          console.log("Adding action");
          const newInstance = new action();
          newInstance.$mount();
          jQuery("#actions").append(newInstance.$el);
        });
      });
    },
    chooseDataSource: () => {
      console.log("Chose datasource");
    },
    showAdvancedOptions() {
      jQuery("#advanced-options").toggle(1000);
      // TODO this should just read from state instead
      this.$data.advancedOptionsIcon = this.$data.advancedOptionsIcon === '+' ? '-' : '+';
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
