/**
 * Detect a file's real type from its leading magic bytes, independent of the
 * client-declared MIME type. Used to reject a file whose bytes don't match its
 * declared type before it reaches a binary parser, so an attacker cannot label a
 * PDF as a spreadsheet (or vice versa) to steer which parser runs on the content.
 */
export function detectMagic(buffer: Buffer): 'pdf' | 'zip' | 'unknown' {
  if (buffer.length >= 5 && buffer.toString('latin1', 0, 5) === '%PDF-') return 'pdf';
  // ZIP (xlsx is a zip): local-file (03 04), empty (05 06), or spanned (07 08) header.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 && buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) return 'zip';
  return 'unknown';
}
