<template>
  <div class="home">
    <LastWave>
    </LastWave>
    <md-snackbar md-position="center" :md-active.sync="showSnackBar" md-persistent>
      You're using the LastWave v3 beta! <router-link to="/beta"><md-button @click="hideSnackbar" class="md-primary">What's new</md-button></router-link>
    </md-snackbar>
  </div>
</template>
<style>
  .md-snackbar-content {
    text-align: center;
  }
</style>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import LastWave from '@/components/LastWave.vue'; // @ is an alias to /src

@Component({
  components: {
    LastWave,
  },
  data() {
    let shouldShowSnackbar = true;
    if (sessionStorage.getItem('hideSnackBar')) {
      shouldShowSnackbar = false;
    }
    return {
      showSnackBar: shouldShowSnackbar,
    };
  },
  methods: {
    hideSnackbar() {
      sessionStorage.setItem('hideSnackBar', 'true');
    },
  },
})
export default class Home extends Vue {}
</script>
