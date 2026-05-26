import { ARCHIVE_EXTENSIONS, EMOJI_FILE_DEFAULT, EMOJI_EXTENSIONS } from './constants';

export function isArchive(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  const parts = lower.split('.').filter(Boolean);

  // 이중 확장자 검사 (e.g. tar.gz, tar.bz2)
  const doubleExt = parts.slice(-2).join('.');
  if (ARCHIVE_EXTENSIONS.has(doubleExt)) return true;

  // 단일 확장자 검사
  const singleExt = parts[parts.length - 1] ?? '';
  return ARCHIVE_EXTENSIONS.has(singleExt);
}

export function formatSize(bytes: number): string {
  const KB = 1024;
  const MB = KB ** 2;
  const GB = KB ** 3;

  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;

  return `${(bytes / GB).toFixed(2)} GB`;
}

/** 파일명 중복 시 숫자 접미사 붙여 고유하게 만들기 (e.g. "file (1).txt") */
export function deduplicateName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) return name;

  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex === -1 ? name : name.slice(0, dotIndex);
  const ext = dotIndex === -1 ? '' : name.slice(dotIndex);

  let counter = 1;
  let candidate = `${base} (${counter})${ext}`;
  while (usedNames.has(candidate)) {
    counter++;
    candidate = `${base} (${counter})${ext}`;
  }
  return candidate;
}

export function getFileExtension(fileName: string): string | undefined {
  return fileName.toLowerCase().split('.').pop();
}

export function getEmoji(fileName: string): string {
  const extension = getFileExtension(fileName);
  if (!extension) return EMOJI_FILE_DEFAULT;
  return EMOJI_EXTENSIONS[extension] ?? EMOJI_FILE_DEFAULT;
}
