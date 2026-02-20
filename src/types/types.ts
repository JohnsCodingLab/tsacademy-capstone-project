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
