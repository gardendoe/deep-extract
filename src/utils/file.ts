import { EMOJI_FILE_DEFAULT, EMOJI_EXTENSIONS } from '@/constants';

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

/**
 * ZIP 항목 경로에서 안전한 파일명만 뽑아낸다.
 * @param entryPath ZIP 항목 경로
 * @returns 안전한 파일명
 */
export function basename(entryPath: string): string | null {
  const normalized = entryPath.replace(/\\/g, '/'); // 윈도우식 역슬래시(\)를 슬래시(/)로 통일
  if (/^(\/|[a-zA-Z]:\/|\/{2})/.test(normalized)) return null; // 절대 경로 형태(/..., C:/..., //... 등)면 위험하므로 거부

  const segments = normalized.split('/').filter(Boolean);
  for (const segment of segments) {
    if (segment === '..') return null; // 경로 어딘가에 ..(상위 디렉터리 이동)이 있으면 거부
  }

  const raw = segments[segments.length - 1]; // 폴더 구조는 버리고 실제 파일명만 평탄화해서 사용
  if (!raw || raw === '.') return null;

  const sanitized = raw.replace(/[\p{Cc}:*?"<>|]/gu, '_').trim(); // 제어 문자, 특수문자를 언더스코어로 치환
  if (!sanitized || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(sanitized)) return null; // 빈 문자열, 윈도우 예약어 거부

  return sanitized;
}
