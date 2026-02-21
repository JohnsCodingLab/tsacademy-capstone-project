export interface OrgRouteParams {
  orgSlug: string;
}

export interface SysUserParams {
  userId: string;
}

export interface OrgUserParams extends Record<string, string> {
  orgSlug: string;
  userId: string;
}

export interface InventoryParams extends Record<string, string> {
  categoryId: string;
  productId: string;
}
