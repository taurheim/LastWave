<template>
  <div class="lastwave-control">
    <div class="viz-select">
      Data Source:
      <select>
        <option v-for="dataSource in dataSources" v-bind:value="dataSource.title" :key="dataSource.title">
          {{ dataSource.title }}
        </option>
      </select>
      //
      Renderer: 
      <select>
        <option v-for="renderer in renderers" v-bind:value="renderer.title" :key="renderer.title">
          {{ renderer.title }}
        </option>
      </select>
    </div>
    <div class="options">
      <template v-for="(opt, key) in options">
        Option {{key}}
      </template>
    </div>
    <div class="submit">
      <button v-on:click="createWave">Submit</button>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import LastWaveEngine from '@/lastwave';
import LastFm from '@/datasources/lastfm';
import WaveGraph from '@/renderers/d3-wave';
import WaveAction from '@/models/WaveAction';
import Option from '@/models/Option';
import Renderer from '@/models/Renderer';
import DataSource from '@/models/DataSource';

export default Vue.extend({
  data() {
    return {
      options: {},
      dataSources: [new LastFm()],
      renderers: [new WaveGraph()],
      actions: [],
    }
  },
  mounted() {
    let rendererOptions: Option[] = [];
    this.$data.renderers.map((renderer: Renderer) => {
      rendererOptions = rendererOptions.concat(renderer.getOptions());
    });

    let dataSourceOptions: Option[] = [];
    this.$data.dataSources.map((dataSource: DataSource) => {
      dataSourceOptions = dataSourceOptions.concat(dataSource.getOptions());
    });

    // Show all options
  },
  methods: {
    createWave: function(evnt: any) {
      console.log("Creating wave");
    }
  }
  
})

</script>
