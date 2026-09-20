import type { DepartmentApi } from '#/api/system/department';

export interface DepartmentFormValues extends DepartmentApi.Fields {
  status?: number;
}
export function newDepartmentValues(parentId = 0): DepartmentFormValues {
  return { parentId, name: '', sort: 0, remark: '', status: 1 };
}
export function departmentPayload(
  values: DepartmentFormValues,
): DepartmentApi.Fields {
  return {
    parentId: values.parentId ?? 0,
    name: values.name?.trim() ?? '',
    sort: values.sort ?? 0,
    remark: values.remark?.trim() ?? '',
  };
}
export function departmentSnapshot(
  values: DepartmentFormValues,
  editing: boolean,
) {
  return JSON.stringify({
    ...departmentPayload(values),
    ...(!editing && { status: values.status ?? 1 }),
  });
}
