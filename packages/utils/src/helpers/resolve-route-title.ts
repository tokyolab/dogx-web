import type { RouteMeta } from '@vben-core/typings';

export function resolveRouteTitle(
  meta: Pick<RouteMeta, 'title' | 'titleIsLiteral'>,
  translate: (key: string) => string,
) {
  if (!meta.title) return '';
  return meta.titleIsLiteral ? meta.title : translate(meta.title);
}
