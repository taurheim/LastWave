<template>
  <div class="home">
    <LastWave>
    </LastWave>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import LastWave from '@/components/LastWave.vue'; // @ is an alias to /src

@Component({
  components: {
    LastWave,
  },
})
export default class Home extends Vue {}
</script>
