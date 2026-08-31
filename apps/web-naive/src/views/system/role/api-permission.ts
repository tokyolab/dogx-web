import type { TreeOption } from 'naive-ui';

import type { RoleApi } from '#/api/system';

const ENABLED_STATUS = 1;

interface APITreeOption extends TreeOption {
  api?: RoleApi.APIItem;
  children?: APITreeOption[];
  kind: 'api' | 'group' | 'service';
}

function buildAPIResourceTree(items: RoleApi.APIItem[]): APITreeOption[] {
  const services = new Map<string, Map<string, RoleApi.APIItem[]>>();

  for (const item of items) {
    if (item.status !== ENABLED_STATUS) continue;

    let groups = services.get(item.serviceName);
    if (!groups) {
      groups = new Map<string, RoleApi.APIItem[]>();
      services.set(item.serviceName, groups);
    }

    const groupItems = groups.get(item.group) ?? [];
    groupItems.push(item);
    groups.set(item.group, groupItems);
  }

  return Array.from(services, ([serviceName, groups]) => ({
    children: Array.from(groups, ([groupName, groupItems]) => ({
      children: groupItems.map((api) => ({
        api,
        checkboxDisabled: api.isRequired,
        isLeaf: true,
        key: api.id,
        kind: 'api' as const,
        label: `${api.name} ${api.method} ${api.path}`,
      })),
      key: `group:${serviceName}:${groupName}`,
      kind: 'group' as const,
      label: groupName,
    })),
    key: `service:${serviceName}`,
    kind: 'service' as const,
    label: serviceName,
  }));
}

function getRequiredAPIIDs(items: RoleApi.APIItem[]): number[] {
  return items
    .filter((item) => item.status === ENABLED_STATUS && item.isRequired)
    .map((item) => item.id)
    .toSorted((left, right) => left - right);
}

function normalizeAPISelection(
  checkedKeys: Array<number | string>,
  requiredAPIIDs: number[] = [],
): number[] {
  const ids = new Set<number>(requiredAPIIDs);
  for (const key of checkedKeys) {
    if (typeof key === 'number' && Number.isSafeInteger(key) && key > 0) {
      ids.add(key);
    }
  }
  return [...ids].toSorted((left, right) => left - right);
}

function filterAPIResourceTreeBySelection(
  nodes: APITreeOption[],
  selectedAPIIDs: ReadonlySet<number>,
): APITreeOption[] {
  const result: APITreeOption[] = [];
  for (const node of nodes) {
    if (node.kind === 'api') {
      if (typeof node.key === 'number' && selectedAPIIDs.has(node.key)) {
        result.push(node);
      }
      continue;
    }

    const children = filterAPIResourceTreeBySelection(
      node.children ?? [],
      selectedAPIIDs,
    );
    if (children.length > 0) {
      result.push({ ...node, children });
    }
  }
  return result;
}

export {
  buildAPIResourceTree,
  filterAPIResourceTreeBySelection,
  getRequiredAPIIDs,
  normalizeAPISelection,
};
export type { APITreeOption };
