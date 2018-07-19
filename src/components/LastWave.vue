<template>
  <div class="lastwave-control">
    <span v-if="currentStage !== undefined">
      {{ currentStage.stageName }} - {{ currentStage.currentSegment }} / {{ currentStage.stageSegments}}
    </span>
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
    <div class="main-options">
      <template v-for="opt in mainOptions">
        <WaveOption v-bind:key="opt.title" v-bind:option="opt"></WaveOption>
      </template>
    </div>
    <hr>
    <div class="options">
      Data Source Options:
      <template v-for="opt in dataSourceOptions">
        <WaveOption v-bind:key="opt.title" v-bind:option="opt" owner="dataSource"></WaveOption>
      </template>
      <hr>
      Renderer Options:
      <template v-for="opt in rendererOptions">
        <WaveOption v-bind:key="opt.title" v-bind:option="opt" owner="renderer"></WaveOption>
      </template>
    </div>
    <div id="actions">

    </div>
    <div class="submit">
      <button v-on:click="createWave">Submit</button>
    </div>
    <div id="visualization">

    </div>
    <pre>
      {{ $store.state }}
    </pre>
  </div>
</template>

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

import LastFm from '@/datasources/lastfm';
import WaveGraph from '@/renderers/d3-wave';
import SaveAsFile from '@/actions/saveAsFile.vue';

export default Vue.extend({
  components: {
    WaveOption,
  },
  data() {
    return {
      dataSources: [new LastFm()],
      renderers: [new WaveGraph()],
      actions: [SaveAsFile],
      dataSourceOptions: [],
      rendererOptions: [],
      mainOptions: [],
    }
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

      engine.CreateWave(dataSource, renderer, dsOptions, renderOptions).then(() => {
        // Display actions
        this.actions.forEach(action => {
          const newInstance = new action();
          newInstance.$mount();
          jQuery("#actions").append(newInstance.$el);
        });

      });
    },
    chooseDataSource: () => {
      console.log("Chose datasource");
    }
  },
  computed: {
    currentStage(): LoadingStage {
      const currentStage: LoadingStage = store.state.stages[store.state.currentStage];
      return currentStage;
    }
  }
  
})

</script>
