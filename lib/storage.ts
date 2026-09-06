/** Browser-safe upload limits. Server-side validation is authoritative. */
const configuredMax = Number.parseInt(process.env.NEXT_PUBLIC_FILE_MAX_SIZE_BYTES ?? '21474836480', 10);

export const MAX_FILE_SIZE_BYTES = Number.isSafeInteger(configuredMax) && configuredMax > 0
  ? configuredMax
  : 21_474_836_480;

export function isAllowedUploadSize(size: number): boolean {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_FILE_SIZE_BYTES;
}
