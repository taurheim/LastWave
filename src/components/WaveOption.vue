<template>
  <div class="option">
    <template v-if="option.mainView && option.type === 'string'">
      <BigInput :option="option">
      </BigInput>
    </template>
    <template v-else-if="option.type === 'dropdown'">
      <DropdownOption v-bind:option="option">
      </DropdownOption>
    </template>
    <template v-else-if="option.type === 'int'">
      <InputOption v-bind:option="option">
      </InputOption>
    </template>
    <template v-else-if="option.type === 'toggle'">
      <ToggleOption v-bind:option="option">
      </ToggleOption>
    </template>
    <template v-else-if="option.type === 'string'">
      <InputOption v-bind:option="option">
      </InputOption>
    </template>
    <template v-else-if="option.type === 'date'">
      <DateOption v-bind:option="option">
      </DateOption>
    </template>
    <template v-else-if="option.type === 'easydate'">
      <BigEasyDate v-bind:option="option">
      </BigEasyDate>
    </template>
    <template v-else-if="option.type === 'optiongallery'">
      <OptionGallery v-bind:option="option">
      </OptionGallery>
    </template>
    <template v-else>
      Not supported: {{ option.type }}
    </template>
  </div>
</template>
<script lang="ts">
import Vue from 'vue'
import DropdownOption from '@/components/options/DropdownOption.vue';
import InputOption from '@/components/options/InputOption.vue';
import ToggleOption from '@/components/options/ToggleOption.vue';
import DateOption from '@/components/options/DateOption.vue';
import BigEasyDate from '@/components/options/BigEasyDate.vue';
import BigInput from './options/BigInput.vue';
import OptionGallery from './options/OptionGallery.vue';

export default Vue.extend({
  components: {
    DropdownOption,
    InputOption,
    ToggleOption,
    DateOption,
    BigEasyDate,
    BigInput,
    OptionGallery,
  },
  props: ["option"],
})
</script>

