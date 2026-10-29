import type { VersionInfo } from "./versions";

/** One history includes generated, edited, and restored snapshots. */
export function sourceMetadata(version: VersionInfo) {
  return {
    id: version.id,
    number: version.number,
    created_at: new Date(version.createdAt).getTime(),
    restored_from: version.restoredFrom,
  };
}
