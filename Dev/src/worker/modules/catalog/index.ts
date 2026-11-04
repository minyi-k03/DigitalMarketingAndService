import {
  changePublicationStatus,
  createCatalogItem,
  getAdminCatalogItem,
  listAdminCatalogItems,
  listChangeLogs,
  updateCatalogItem,
  type UpdateCatalogItemRequest,
} from './application/admin';
import type { CatalogActor, CatalogDeps } from './deps';
import type { PublicationStatus } from './domain/publication-status';

export type { CatalogActor, CatalogDeps } from './deps';
export type { CatalogItem, PublicationStatus } from './infra/catalog-repo';

type CreateInput = Parameters<typeof createCatalogItem>[2];

/** Catalog & Marketplace 모듈의 공개 인터페이스. 다른 모듈은 이 객체로만 호출한다 */
export function createCatalogService(deps: CatalogDeps) {
  return {
    createCatalogItem: (actor: CatalogActor, input: CreateInput) =>
      createCatalogItem(deps, actor, input),
    updateCatalogItem: (actor: CatalogActor, id: string, request: UpdateCatalogItemRequest) =>
      updateCatalogItem(deps, actor, id, request),
    getAdminCatalogItem: (id: string) => getAdminCatalogItem(deps, id),
    listAdminCatalogItems: (filter?: { publicationStatus?: PublicationStatus }) =>
      listAdminCatalogItems(deps, filter),
    changePublicationStatus: (actor: CatalogActor, id: string, to: PublicationStatus) =>
      changePublicationStatus(deps, actor, id, to),
    listChangeLogs: (catalogItemId: string) => listChangeLogs(deps, catalogItemId),
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
