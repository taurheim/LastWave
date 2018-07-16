<template>
  <div class="lastwave-control">
    <div class="viz-select">
      Data Source:
      <select>
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
        <WaveOption v-bind:key="opt.title" v-bind:option="opt"></WaveOption>
      </template>
      <br>
      Renderer Options:
      <template v-for="opt in rendererOptions">
        <WaveOption v-bind:key="opt.title" v-bind:option="opt"></WaveOption>
      </template>
    </div>
    <div class="submit">
      <button v-on:click="createWave">Submit</button>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import WaveOption from '@/components/WaveOption.vue';
import LastWaveEngine from '@/lastwave';
import LastFm from '@/datasources/lastfm';
import WaveGraph from '@/renderers/d3-wave';
import WaveAction from '@/models/WaveAction';
import Option from '@/models/Option';
import Renderer from '@/models/Renderer';
import DataSource from '@/models/DataSource';

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
    this.$data.rendererOptions = [];
    this.$data.renderers.map((renderer: Renderer) => {
      this.$data.rendererOptions = this.$data.rendererOptions.concat(renderer.getOptions());
    });

    this.$data.dataSourceOptions = [];
    this.$data.dataSources.map((dataSource: DataSource) => {
      this.$data.dataSourceOptions = this.$data.dataSourceOptions.concat(dataSource.getOptions());
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
