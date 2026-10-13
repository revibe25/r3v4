/**
 * Shared audio-file check for the instrument uploaders (drum pads, piano keys).
 *
 * Browsers and operating systems report MIME types inconsistently: a WAV can arrive
 * as `audio/wav`, `audio/x-wav`, or with an empty type, and AIFF as `audio/x-aiff`.
 * A file is therefore accepted when its MIME type is `audio/*` OR its extension is a
 * known audio format.
 */
const AUDIO_EXTENSIONS = [
  'wav', 'wave', 'mp3', 'ogg', 'oga', 'opus', 'flac', 'aif', 'aiff', 'm4a', 'aac', 'webm',
] as const;

const AUDIO_EXT_RE = new RegExp(`\\.(${AUDIO_EXTENSIONS.join('|')})$`, 'i');

/** Value for an <input type="file" accept="…"> so the OS picker shows every supported format. */
export const AUDIO_ACCEPT = ['audio/*', ...AUDIO_EXTENSIONS.map(ext => `.${ext}`)].join(',');

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXT_RE.test(file.name);
}
