import type { TreeOption } from 'naive-ui';

import type { MenuApi } from '#/api/system/menu';

export interface MenuPermissionNode extends TreeOption {
  key: number;
  label: string;
  menu: MenuApi.Item;
  children?: MenuPermissionNode[];
}

export function buildMenuPermissionTree(items: MenuApi.Item[]) {
  const nodes = new Map<number, MenuPermissionNode>(
    items.map((menu) => [menu.id, { key: menu.id, label: menu.name, menu }]),
  );
  const roots: MenuPermissionNode[] = [];
  for (const menu of items) {
    const node = nodes.get(menu.id);
    if (!node) continue;
    if (menu.parentId === 0) roots.push(node);
    else {
      const parent = nodes.get(menu.parentId);
      if (parent && parent.menu.type !== 3) (parent.children ??= []).push(node);
    }
  }
  return roots;
}

export function menuGrantIDs(
  items: MenuApi.Item[],
  keys: Array<number | string>,
) {
  const nodes = new Map(items.map((menu) => [menu.id, menu]));
  const selected = new Set<number>();
  for (const key of keys) {
    let node = nodes.get(Number(key));
    while (node && !selected.has(node.id)) {
      selected.add(node.id);
      node = nodes.get(node.parentId);
    }
  }
  return [...selected].toSorted((a, b) => a - b);
}

export function menuCheckState(tree: MenuPermissionNode[], grants: number[]) {
  const selected = new Set(grants);
  const checked: number[] = [];
  const indeterminate: number[] = [];
  const bareBranches: number[] = [];
  const visit = (node: MenuPermissionNode): boolean => {
    if (!node.children?.length) {
      if (selected.has(node.key)) checked.push(node.key);
      return selected.has(node.key);
    }
    const childStates = node.children.map((child) => visit(child));
    const full = selected.has(node.key) && childStates.every(Boolean);
    if (selected.has(node.key) && !full) indeterminate.push(node.key);
    if (
      selected.has(node.key) &&
      !node.children.some((child) => selected.has(child.key))
    ) {
      bareBranches.push(node.key);
    }
    return full;
  };
  tree.forEach((node) => visit(node));
  // Feed only actual leaves to native cascade. Stored ancestor IDs must not
  // silently select new children that were added after the last authorization.
  return { checked, indeterminate, bareBranches };
}

export function updateMenuGrants(
  items: MenuApi.Item[],
  tree: MenuPermissionNode[],
  previous: number[],
  checked: Array<number | string>,
  changedID: number,
) {
  const ancestors = new Set(menuGrantIDs(items, [changedID]));
  const retained = menuCheckState(tree, previous).bareBranches.filter((id) => {
    // A formerly leaf page can now have elements without grants. Keep it on
    // unrelated edits, but let native checks on its own branch replace it.
    return !ancestors.has(id) && !menuGrantIDs(items, [id]).includes(changedID);
  });
  return menuGrantIDs(items, [...checked, ...retained]);
}
