/** Fail-closed extraction for installer-derived SteamOS shell fixtures. */

/**
 * Extract shell source between verified boundaries without executing it.
 * @param {string} source Complete setup source.
 * @param {string} startMarker First included marker.
 * @param {string} endMarker First excluded marker.
 * @returns {string} Source including the start marker and excluding the end marker.
 * @throws {Error} When a marker is empty, missing, duplicated, or the end does not follow the start.
 */
export function extractSetupSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (
    !startMarker ||
    !endMarker ||
    start < 0 ||
    end <= start ||
    source.indexOf(startMarker, start + startMarker.length) !== -1 ||
    source.indexOf(endMarker, end + endMarker.length) !== -1
  ) {
    throw new Error("Invalid SteamOS setup fixture boundaries");
  }
  return source.slice(start, end);
}
