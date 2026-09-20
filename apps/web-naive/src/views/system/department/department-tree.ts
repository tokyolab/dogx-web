import type { DepartmentApi } from '#/api/system/department';

export interface DepartmentOption {
  label: string;
  key: number;
  disabled?: boolean;
  children?: DepartmentOption[];
}

// Keep the ancestry of matches: filtering a flat list directly would turn
// matching descendants into orphans in VXE's transformed tree.
export function filterDepartmentTree(
  items: DepartmentApi.Item[],
  keyword = '',
  status?: number,
) {
  const byID = new Map(items.map((item) => [item.id, item]));
  const selected = new Set<number>();
  const term = keyword.trim().toLocaleLowerCase();
  for (const item of items) {
    if (
      (term && !item.name.toLocaleLowerCase().includes(term)) ||
      (status !== undefined && item.status !== status)
    )
      continue;
    let current: DepartmentApi.Item | undefined = item;
    const visited = new Set<number>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      selected.add(current.id);
      current = byID.get(current.parentId);
    }
  }
  return items.filter((item) => selected.has(item.id));
}

export function departmentParentOptions(
  items: DepartmentApi.Item[],
  rootLabel: string,
  currentID?: number,
): DepartmentOption[] {
  const excluded = new Set<number>();
  const children = new Map<number, DepartmentApi.Item[]>();
  for (const item of items) {
    const siblings = children.get(item.parentId) ?? [];
    siblings.push(item);
    children.set(item.parentId, siblings);
  }
  const pending = currentID ? [currentID] : [];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined) break;
    if (excluded.has(id)) continue;
    excluded.add(id);
    for (const child of children.get(id) ?? []) pending.push(child.id);
  }
  const options = new Map<number, DepartmentOption>();
  for (const item of items) {
    if (!excluded.has(item.id))
      options.set(item.id, { key: item.id, label: item.name });
  }
  const root: DepartmentOption = { key: 0, label: rootLabel, children: [] };
  for (const item of items) {
    const option = options.get(item.id);
    if (!option) continue;
    const parent = item.parentId === 0 ? root : options.get(item.parentId);
    if (parent) (parent.children ??= []).push(option);
  }
  return [root];
}
export function departmentOptions(
  items: DepartmentApi.Item[],
  currentID?: number,
  assigning = false,
): DepartmentOption[] {
  const tree = departmentParentOptions(items, '');
  function visit(nodes: DepartmentOption[]) {
    for (const node of nodes) {
      const item = items.find((item) => item.id === node.key);
      node.disabled = assigning && item?.status !== 1 && node.key !== currentID;
      if (node.children) visit(node.children);
    }
  }
  const nodes = tree[0]?.children ?? [];
  visit(nodes);
  return nodes;
}
