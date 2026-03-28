/** Customer-created requests start here; superadmin moves to admin; admin broadcasts to drivers. */
export const REQUEST_STAGE_SUPERADMIN = "superadmin";
export const REQUEST_STAGE_ADMIN = "admin";

export function pendingVisibleToSuperadmin(data) {
  if (data.status !== "pending") return false;
  const s = data.requestStage;
  return s === REQUEST_STAGE_SUPERADMIN || s === undefined || s === null;
}

export function pendingVisibleToAdmin(data) {
  return data.status === "pending" && data.requestStage === REQUEST_STAGE_ADMIN;
}
