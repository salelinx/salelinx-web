// Human-readable byte formatting for the admin Storage module. Binary units
// to match how the tier caps were chosen (500 MB = 524288000 = 500 * 1024^2,
// 1 GB = 1073741824 = 1024^3 in the migration 011 seed), so a maxed-out Pro
// user reads "500 MB / 500 MB", not "524.3 MB / 500 MB".
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = "B";
  for (const next of units) {
    if (value < 1024) break;
    value = value / 1024;
    unit = next;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}
