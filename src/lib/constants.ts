import type { Accept } from 'react-dropzone';
import { Archive, Package, Shield } from 'lucide-react';

// Dropzone Config
export const MAX_FILE_DEPTH = 12;
export const FILE_MAX_COUNT = 20;
export const FILE_MIN_SIZE = 1_000; // 1KB
export const FILE_MAX_SIZE = 2_000_000_000; // 2GB

export const META_CHIPS = [
  { icon: Shield, label: '서버 전송 없음' },
  { icon: Package, label: '최대 깊이 12단계' },
  { icon: Archive, label: '다중 파일 지원' },
];

// Extensions
export const ARCHIVE_EXTENSIONS = new Set([
  'zip',
  '7z',
  'rar',
  'tar',
  'gz',
  'tgz',
  'bz2',
  'tbz',
  'tbz2',
  'xz',
  'cab',
  'iso',
  'cbr',
  'cbz',
  'tar.gz',
  'tar.bz2',
  'tar.xz',
]);

export const ACCEPT_EXTENSIONS = Object.freeze<Accept>({
  'application/zip': ['.zip'],
  'application/vnd.rar': ['.rar'],
  'application/x-7z-compressed': ['.7z'],
  'application/x-tar': ['.tar'],
  'application/gzip': ['.gz', '.tgz', '.tar.gz'],
  'application/x-bzip2': ['.bz2', '.tar.bz2'],
  'application/x-xz': ['.xz', '.tar.xz'],
  'application/zstd': ['.zst', '.zstd', '.tar.zst', '.tar.zstd'],
});

// Emoji
export const EMOJI_ARCHIVE_DEFAULT = '📦';
export const EMOJI_FILE_DEFAULT = '📄';

export const EMOJI_EXTENSIONS: Readonly<Record<string, string>> = {
  // 텍스트, 문서, package (Sims4)
  txt: '📄',
  md: '📄',
  pdf: '📄',
  doc: '📄',
  docx: '📄',
  csv: '📄',
  ppt: '📄',
  pptx: '📄',
  xls: '📄',
  xlsx: '📄',
  package: '📄',

  // 이미지
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
  bmp: '🖼️',

  // 비디오
  mp4: '🎬',
  avi: '🎬',
  mov: '🎬',
  mkv: '🎬',
  webm: '🎬',

  // 오디오
  mp3: '🎵',
  wav: '🎵',
  flac: '🎵',
  ogg: '🎵',
  aac: '🎵',

  // 코드
  js: '💻',
  ts: '💻',
  jsx: '💻',
  tsx: '💻',
  py: '💻',
  java: '💻',
  cpp: '💻',
  c: '💻',
  go: '💻',
  rs: '💻',

  // 웹
  html: '🌐',
  css: '🎨',

  // 데이터
  json: '📋',
  xml: '📋',
  yaml: '📋',
  yml: '📋',

  // 실행, 스크립트
  exe: '⚙️',
  sh: '⚙️',
  bat: '⚙️',
};
