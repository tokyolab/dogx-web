<script setup lang="ts">
import { computed, ref } from 'vue';

import { Profile } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import ProfileBase from './base-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';

const userStore = useUserStore();

const tabsValue = ref<string>('basic');

const tabs = computed(() => [
  {
    label: $t('profile.basicSettings'),
    value: 'basic',
  },
  {
    label: $t('profile.updatePassword'),
    value: 'password',
  },
]);
</script>
<template>
  <Profile
    v-model:model-value="tabsValue"
    :title="$t('profile.title')"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
    </template>
  </Profile>
</template>
