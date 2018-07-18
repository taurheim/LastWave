<template>
  <div class="lastwave-control">
    <span v-if="currentStage !== undefined">
      {{ currentStage.stageName }} - {{ currentStage.currentSegment }} / {{ currentStage.stageSegments}}
    </span>
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
    <div class="options">
      Data Source Options:
      <template v-for="opt in dataSourceOptions">
        <WaveOption v-bind:key="opt.title" v-bind:option="opt" owner="dataSource"></WaveOption>
      </template>
      <br>
      Renderer Options:
      <template v-for="opt in rendererOptions">
        <WaveOption v-bind:key="opt.title" v-bind:option="opt" owner="renderer"></WaveOption>
      </template>
    </div>
    <div class="submit">
      <button v-on:click="createWave">Submit</button>
    </div>
    <div id="visualization">

    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import store from '@/store';
import WaveOption from '@/components/WaveOption.vue';
import LastWaveEngine from '@/lastwave';
import LastFm from '@/datasources/lastfm';
import WaveGraph from '@/renderers/d3-wave';
import WaveAction from '@/models/WaveAction';
import Option from '@/models/Option';
import Renderer from '@/models/Renderer';
import DataSource from '@/models/DataSource';
import LoadingStage from '@/models/LoadingStage';

export default Vue.extend({
  components: {
    WaveOption,
  },
  data() {
    return {
      dataSources: [new LastFm()],
      renderers: [new WaveGraph()],
      dataSourceOptions: [],
      rendererOptions: [],
      actions: [],
    }
  },
  mounted() {
    this.$data.rendererOptions = this.$data.renderers[0].getOptions();
    this.$data.dataSourceOptions = this.$data.dataSources[0].getOptions();
  },
  methods: {
    createWave: function(evnt: any) {
      console.log("Creating wave");

      const engine = new LastWaveEngine();
      const dataSource = this.$data.dataSources[0];
      const dsOptions = store.state.dataSourceOptions;
      const renderer = this.$data.renderers[0];
      const renderOptions = store.state.rendererOptions;

      engine.CreateWave(dataSource, renderer, dsOptions, renderOptions);
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
