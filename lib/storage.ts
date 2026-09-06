/** Browser-safe upload limits. Server-side validation is authoritative. */
const configuredMax = Number.parseInt(process.env.NEXT_PUBLIC_FILE_MAX_SIZE_BYTES ?? '52428800', 10);

export const MAX_FILE_SIZE_BYTES = Number.isSafeInteger(configuredMax) && configuredMax > 0
  ? configuredMax
  : 52_428_800;

export function isAllowedUploadSize(size: number): boolean {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_FILE_SIZE_BYTES;
}
