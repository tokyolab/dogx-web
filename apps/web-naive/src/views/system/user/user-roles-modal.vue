<script lang="ts" setup>
import type { UserApi } from '#/api/system';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { dialog, message } from '#/adapter/naive';
import { getManagedUserApi, updateUserRolesApi } from '#/api/system';
import { useAuthStore } from '#/store';

import { editableRoleIDs, userActionAvailability } from './user-form';
import UserRoleSelect from './user-role-select.vue';

interface ModalData {
  id: number;
  onSuccess?: () => Promise<void> | void;
}
const record = ref<UserApi.UserItem>();
const selected = ref<number[]>([]);
const submitting = ref(false);
const ready = ref(false);
const authStore = useAuthStore();
const userStore = useUserStore();
let initial = '';
let generation = 0;
const snapshot = () => JSON.stringify(selected.value.toSorted((a, b) => a - b));

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  async onBeforeClose() {
    if (submitting.value) return false;
    if (!ready.value || initial === snapshot()) return true;
    return await new Promise<boolean>((resolve) => {
      dialog.warning({
        content: $t('page.system.user.discardContent'),
        maskClosable: false,
        negativeText: $t('common.cancel'),
        onClose: () => resolve(false),
        onNegativeClick: () => resolve(false),
        onPositiveClick: () => resolve(true),
        positiveText: $t('page.system.role.discardChanges'),
        title: $t('page.system.role.discardChangesTitle'),
      });
    });
  },
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    if (!record.value || !ready.value || submitting.value) return;
    if (selected.value.length > 100) {
      message.warning($t('page.system.user.tooManyRoles'));
      return;
    }
    if (initial === snapshot()) {
      modalApi.close();
      return;
    }
    const id = record.value.id;
    submitting.value = true;
    modalApi.lock();
    try {
      await updateUserRolesApi(id, selected.value);
      initial = snapshot();
      message.success($t('page.system.user.rolesSaved'));
    } finally {
      submitting.value = false;
      modalApi.unlock();
    }
    modalApi.close();
    await (id === Number(userStore.userInfo?.userId)
      ? authStore.logout(false, false)
      : modalApi.getData<ModalData>()?.onSuccess?.());
  },
  async onOpenChange(open) {
    const token = ++generation;
    ready.value = false;
    record.value = undefined;
    selected.value = [];
    initial = '';
    if (!open) return;
    modalApi.setState({
      confirmDisabled: true,
      loading: true,
      title: $t('page.system.user.assignRoles'),
    });
    try {
      const user = await getManagedUserApi(modalApi.getData<ModalData>().id);
      if (token !== generation) return;
      if (
        !userActionAvailability(user, Number(userStore.userInfo?.userId))
          .canAssignRoles
      ) {
        message.warning($t('page.system.user.superAdminRolesProtected'));
        modalApi.close();
        return;
      }
      record.value = user;
      selected.value = editableRoleIDs(user.roles);
      initial = snapshot();
      ready.value = true;
      modalApi.setState({
        title: `${$t('page.system.user.assignRoles')} · ${user.nickname}`,
      });
    } catch {
      if (token === generation) modalApi.close();
    } finally {
      if (token === generation)
        modalApi.setState({ confirmDisabled: !ready.value, loading: false });
    }
  },
});
defineExpose(modalApi);
</script>

<template>
  <Modal>
    <div v-if="record && ready" class="space-y-3">
      <UserRoleSelect
        v-model:value="selected"
        :assigned="record.roles"
        :disabled="submitting"
      />
    </div>
  </Modal>
</template>
