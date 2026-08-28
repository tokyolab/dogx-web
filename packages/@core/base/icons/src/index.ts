import type { IconifyIcon, IconifyJSON } from '@iconify/vue/offline';

import {
  addCollection as addOfflineCollection,
  addIcon as addOfflineIcon,
} from '@iconify/vue/offline';

export * from './create-icon';

export * from './lucide';

export type {
  IconifyIcon as IconifyIconStructure,
  IconifyJSON,
} from '@iconify/vue/offline';
export { Icon as IconifyIcon } from '@iconify/vue/offline';

const registeredIconNames = new Set<string>();

function addCollection(data: IconifyJSON, prefix: boolean | string = true) {
  addOfflineCollection(data, prefix);

  let collectionPrefix = typeof prefix === 'string' ? prefix : '';
  if (prefix === true) {
    collectionPrefix = data.prefix;
  }
  for (const name of Object.keys(data.icons)) {
    registeredIconNames.add(
      collectionPrefix.length > 0 ? `${collectionPrefix}:${name}` : name,
    );
  }
}

function addIcon(name: string, data: IconifyIcon) {
  addOfflineIcon(name, data);
  registeredIconNames.add(name);
}

function listIcons(provider = '', prefix = ''): string[] {
  if (provider.length > 0) {
    return [];
  }

  const icons = [...registeredIconNames];
  return prefix.length > 0
    ? icons.filter((name) => name.startsWith(`${prefix}:`))
    : icons;
}

export { addCollection, addIcon, listIcons };
