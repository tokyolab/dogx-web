<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { UserApi } from '#/api/system';

import { markRaw, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useVbenForm, z } from '#/adapter/form';
import { dialog, message } from '#/adapter/naive';
import { createUserApi, getManagedUserApi, updateUserApi } from '#/api/system';
import { isValidNewPassword } from '#/utils/password';

import { normalizeUserProfile } from './user-form';
import UserRoleSelect from './user-role-select.vue';

interface ModalData {
  id?: number;
  onSuccess?: () => Promise<void> | void;
}
interface FormValues extends UserApi.Profile {
  password: string;
  roleIds?: number[];
  status: number;
  username: string;
}

const currentID = ref<number>();
const submitting = ref(false);
const ready = ref(false);
let initial = '';
let generation = 0;

function createSchema(editing: boolean): VbenFormSchema[] {
  const requiredText = (label: string, max: number) =>
    z
      .string()
      .trim()
      .min(1, { message: $t('page.system.user.required', { field: label }) })
      .max(max, { message: $t('page.system.user.tooLong', { max }) });
  const schema: VbenFormSchema[] = [
    {
      component: 'Input',
      componentProps: {
        disabled: editing,
        maxlength: 64,
        placeholder: $t('page.system.user.usernamePlaceholder'),
        showCount: true,
      },
      fieldName: 'username',
      label: $t('page.system.user.username'),
      rules: requiredText($t('page.system.user.username'), 64),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: $t('page.system.user.nicknamePlaceholder'),
        showCount: true,
      },
      fieldName: 'nickname',
      label: $t('page.system.user.nickname'),
      rules: requiredText($t('page.system.user.nickname'), 64),
    },
  ];
  if (!editing)
    schema.push(
      {
        component: 'NewPasswordInput',
        componentProps: {
          placeholder: $t('page.system.user.passwordPlaceholder'),
        },
        fieldName: 'password',
        label: $t('page.system.user.password'),
        rules: z.string().refine(isValidNewPassword, {
          message: $t('page.auth.passwordRules.invalid'),
        }),
      },
      {
        component: markRaw(UserRoleSelect),
        defaultValue: [],
        fieldName: 'roleIds',
        label: $t('page.system.user.roles'),
      },
    );
  schema.push(
    {
      component: 'Input',
      componentProps: {
        maxlength: 255,
        placeholder: $t('page.system.user.emailPlaceholder'),
        showCount: true,
      },
      fieldName: 'email',
      label: $t('page.system.user.email'),
      rules: z
        .string()
        .trim()
        .email({ message: $t('page.system.user.emailInvalid') })
        .or(z.literal(''))
        .optional(),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 32,
        placeholder: $t('page.system.user.phonePlaceholder'),
        showCount: true,
      },
      fieldName: 'phone',
      label: $t('page.system.user.phone'),
      rules: z
        .string()
        .max(32, { message: $t('page.system.user.tooLong', { max: 32 }) })
        .optional(),
    },
    {
      component: 'Input',
      componentProps: {
        autosize: { maxRows: 5, minRows: 3 },
        maxlength: 500,
        placeholder: $t('page.system.user.remarkPlaceholder'),
        showCount: true,
        type: 'textarea',
      },
      fieldName: 'remark',
      label: $t('page.system.user.remark'),
      rules: z
        .string()
        .max(500, { message: $t('page.system.user.tooLong', { max: 500 }) })
        .optional(),
    },
  );
  if (!editing)
    schema.push({
      component: 'RadioGroup',
      componentProps: {
        isButton: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('page.system.user.status'),
      rules: z.number(),
    });
  return schema;
}

function snapshot(values: FormValues) {
  const profile = normalizeUserProfile(values);
  // Editing only saves profile fields; account and role fields belong to
  // separate operations and may be absent from the edit form.
  if (currentID.value) return JSON.stringify(profile);
  return JSON.stringify({
    ...profile,
    password: values.password ?? '',
    roleIds: (values.roleIds ?? []).toSorted((a, b) => a - b),
    status: values.status,
    username: values.username?.trim() ?? '',
  });
}

async function beforeClose() {
  if (submitting.value) return false;
  if (
    !ready.value ||
    !initial ||
    snapshot(await formApi.getValues<FormValues>()) === initial
  )
    return true;
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
}

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  schema: createSchema(false),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onBeforeClose: beforeClose,
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    if (submitting.value || !ready.value) return;
    submitting.value = true;
    modalApi.lock();
    try {
      const validation = await formApi.validate();
      if (!validation.valid) return;
      const values = await formApi.getValues<FormValues>();
      const roleIDs = values.roleIds ?? [];
      if (!currentID.value && roleIDs.length > 100) {
        message.warning($t('page.system.user.tooManyRoles'));
        return;
      }
      const profile = normalizeUserProfile(values);
      await (currentID.value
        ? updateUserApi({ ...profile, id: currentID.value })
        : createUserApi({
            ...profile,
            password: values.password,
            roleIds: roleIDs,
            status: values.status,
            username: values.username.trim(),
          }));
      initial = snapshot(values);
      message.success($t('page.system.user.saveSuccess'));
    } finally {
      submitting.value = false;
      modalApi.unlock();
    }
    modalApi.close();
    await modalApi.getData<ModalData>()?.onSuccess?.();
  },
  async onOpenChange(open) {
    const token = ++generation;
    ready.value = false;
    initial = '';
    if (!open) {
      currentID.value = undefined;
      await formApi.resetForm();
      return;
    }
    currentID.value = modalApi.getData<ModalData>()?.id;
    modalApi.setState({
      confirmDisabled: true,
      loading: true,
      title: $t(
        currentID.value
          ? 'page.system.user.editTitle'
          : 'page.system.user.createTitle',
      ),
    });
    formApi.setState({ schema: createSchema(!!currentID.value) });
    try {
      await nextTick();
      if (token !== generation) return;
      await formApi.resetForm();
      if (token !== generation) return;
      const values: FormValues = {
        email: '',
        nickname: '',
        password: '',
        phone: '',
        remark: '',
        roleIds: [],
        status: 1,
        username: '',
      };
      if (currentID.value)
        Object.assign(values, await getManagedUserApi(currentID.value));
      if (token !== generation) return;
      await formApi.setValues(values);
      if (token !== generation) return;
      // Vben filters fields while loading. Compare the populated form with
      // later form values, not with the unfiltered API/default object.
      const populatedValues = await formApi.getValues<FormValues>();
      if (token !== generation) return;
      initial = snapshot(populatedValues);
      ready.value = true;
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
    <Form>
      <template #roleIds="{ value, handleChange }">
        <!-- Mount after initialization so opening an edit form never loads role options. -->
        <UserRoleSelect
          v-if="ready"
          :disabled="submitting"
          :value="value ?? []"
          @update:value="handleChange"
        />
      </template>
    </Form>
  </Modal>
</template>
