<template>
  <div class="option">
    <template v-if="option.type === 'dropdown'">
      <DropdownOption v-bind:title="option.title" v-bind:options="option.options">
      </DropdownOption>
    </template>
    <template v-else-if="option.type === 'int'">
      <InputOption v-bind:title="option.title" v-bind:defaultValue="option.defaultValue">
      </InputOption>
    </template>
    <template v-else-if="option.type === 'toggle'">
      <ToggleOption v-bind:title="option.title" v-bind:defaultValue="option.defaultValue">
      </ToggleOption>
    </template>
    <template v-else-if="option.type === 'string'">
      <InputOption v-bind:title="option.title" v-bind:defaultValue="option.defaultValue">
      </InputOption>
    </template>
    <template v-else-if="option.type === 'date'">
      <DateOption v-bind:title="option.title" v-bind:defaultValue="option.defaultValue">
      </DateOption>
    </template>
    <template v-else>
      Not supported.
    </template>
  </div>
</template>
<script lang="ts">
import Vue from 'vue'
import DropdownOption from '@/components/options/DropdownOption.vue';
import InputOption from '@/components/options/InputOption.vue';
import ToggleOption from '@/components/options/ToggleOption.vue';
import DateOption from '@/components/options/DateOption.vue';

export default Vue.extend({
  components: {
    DropdownOption,
    InputOption,
    ToggleOption,
    DateOption,
  },
  props: ["option"],
})
</script>

