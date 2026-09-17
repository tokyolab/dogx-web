import type { MenuApi } from '#/api/system/menu';

export interface MenuFormValues extends Omit<
  MenuApi.Fields,
  'external' | 'keepAlive' | 'visible'
> {
  external: number;
  keepAlive: number;
  visible: number;
  status?: number;
}
export function newMenuValues(parentId = 0, type = 1): MenuFormValues {
  return {
    parentId,
    type,
    name: '',
    routeName: '',
    path: '',
    component: '',
    permission: '',
    icon: '',
    sort: 0,
    visible: 1,
    external: 0,
    keepAlive: 0,
    remark: '',
    status: 1,
  };
}
export function menuFormValues(item: MenuApi.Item): MenuFormValues {
  return {
    ...item,
    visible: Number(item.visible),
    external: Number(item.external),
    keepAlive: Number(item.keepAlive),
  };
}
export function menuPayload(values: MenuFormValues): MenuApi.Fields {
  const element = values.type === 3;
  const page = values.type === 2;
  const external = page && values.external === 1;
  return {
    parentId: values.parentId ?? 0,
    type: values.type,
    name: values.name?.trim() ?? '',
    sort: values.sort ?? 0,
    remark: values.remark?.trim() ?? '',
    permission: element ? (values.permission?.trim() ?? '') : '',
    routeName: element ? '' : (values.routeName?.trim() ?? ''),
    path: element ? '' : (values.path?.trim() ?? ''),
    component: page && !external ? (values.component?.trim() ?? '') : '',
    icon: element ? '' : (values.icon?.trim() ?? ''),
    visible: !element && values.visible === 1,
    keepAlive: page && !external && values.keepAlive === 1,
    external,
  };
}
export function menuSnapshot(values: MenuFormValues, editing: boolean) {
  return JSON.stringify({
    ...menuPayload(values),
    ...(!editing && { status: values.status ?? 1 }),
  });
}
export function validMenuPath(value: string, external: boolean) {
  if (/\s/.test(value)) return false;
  if (external) {
    try {
      const url = new URL(value);
      return (
        /^https?:$/.test(url.protocol) &&
        !!url.hostname &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }
  return (
    value.startsWith('/') && !value.startsWith('//') && !/[?#\\]/.test(value)
  );
}
