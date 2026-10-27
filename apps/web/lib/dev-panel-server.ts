export function isDevPanelRouteEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.DEV_PANEL_ENABLED === "1"
  );
}
