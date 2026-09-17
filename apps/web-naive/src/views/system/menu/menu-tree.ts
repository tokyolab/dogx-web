import type { MenuApi } from '#/api/system/menu';

export interface MenuOption {
  label: string;
  key: number;
  disabled?: boolean;
  children?: MenuOption[];
}

// Keep the ancestry of matches: filtering a flat list directly would turn
// matching descendants into orphans in VXE's transformed tree.
export function filterMenuTree(
  items: MenuApi.Item[],
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
    let current: MenuApi.Item | undefined = item;
    const visited = new Set<number>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      selected.add(current.id);
      current = byID.get(current.parentId);
    }
  }
  return items.filter((item) => selected.has(item.id));
}

export function menuParentOptions(
  items: MenuApi.Item[],
  rootLabel: string,
  currentID?: number,
): MenuOption[] {
  const excluded = new Set<number>();
  const children = new Map<number, MenuApi.Item[]>();
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
  const options = new Map<number, MenuOption>();
  for (const item of items) {
    if (!excluded.has(item.id) && item.type !== 3)
      options.set(item.id, { key: item.id, label: item.name });
  }
  const root: MenuOption = { key: 0, label: rootLabel, children: [] };
  for (const item of items) {
    const option = options.get(item.id);
    if (!option) continue;
    const parent = item.parentId === 0 ? root : options.get(item.parentId);
    if (parent) (parent.children ??= []).push(option);
  }
  return [root];
}
