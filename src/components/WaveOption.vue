<template>
  <div class="option">
    <template v-if="option.isImportant && (option instanceof StringOption)">
      <BigInput :option="option">
      </BigInput>
    </template>
    <template v-else-if="(option instanceof StringChoiceOption)">
      <DropdownOption v-bind:option="option">
      </DropdownOption>
    </template>
    <template v-else-if="(option instanceof StringOption)">
      <InputOption v-bind:option="option">
      </InputOption>
    </template>
    <template v-else-if="(option instanceof BooleanOption)">
      <Toggle v-bind:option="option">
      </Toggle>
    </template>
    <template v-else-if="(option instanceof DateOption)">
      <DateSelector v-bind:option="option">
      </DateSelector>
    </template>
    <template v-else-if="(option instanceof EasyDateOption)">
      <BigEasyDate v-bind:option="option">
      </BigEasyDate>
    </template>
    <template v-else-if="(option instanceof ImageChoiceOption)">
      <OptionGallery v-bind:option="option">
      </OptionGallery>
    </template>
    <template v-else>
      Not supported: {{ option }}
    </template>
  </div>
</template>
<script lang="ts">
import Vue from 'vue';
import DropdownOption from '@/components/options/DropdownOption.vue';
import InputOption from '@/components/options/InputOption.vue';
import Toggle from '@/components/options/ToggleOption.vue';
import DateSelector from '@/components/options/DateOption.vue';
import BigEasyDate from '@/components/options/BigEasyDate.vue';
import BigInput from './options/BigInput.vue';
import OptionGallery from './options/OptionGallery.vue';

import Option from '@/models/Option';
import BooleanOption from '@/models/options/BooleanOption';
import DateOption from '@/models/options/DateOption';
import EasyDateOption from '@/models/options/EasyDateOption';
import ImageChoiceOption from '@/models/options/ImageChoiceOption';
import StringChoiceOption from '@/models/options/StringChoiceOption';
import StringOption from '@/models/options/StringOption';

/*
  https://github.com/vuejs/vue/issues/7708
*/
Vue.prototype.BooleanOption = BooleanOption;
Vue.prototype.DateOption = DateOption;
Vue.prototype.EasyDateOption = EasyDateOption;
Vue.prototype.ImageChoiceOption = ImageChoiceOption;
Vue.prototype.StringChoiceOption = StringChoiceOption;
Vue.prototype.StringOption = StringOption;

export default Vue.extend({
  components: {
    DropdownOption,
    InputOption,
    Toggle,
    DateSelector,
    BigEasyDate,
    BigInput,
    OptionGallery,
  },
  props: [
    'option',
  ],
});
</script>

