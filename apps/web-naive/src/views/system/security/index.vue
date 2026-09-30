<script setup lang="ts">
import { Page } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NCard, NTabPane, NTabs } from 'naive-ui';

import LoginProtection from './login-protection.vue';

defineOptions({ name: 'SecuritySettings' });
</script>

<template>
  <Page auto-content-height>
    <NCard>
      <NTabs default-value="login" type="line" placement="top">
        <NTabPane name="login" :tab="$t('security.login')">
          <LoginProtection />
        </NTabPane>
      </NTabs>
    </NCard>
  </Page>
</template>
