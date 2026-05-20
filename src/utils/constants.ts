export const ARCHIVE_EXTENSIONS = new Set([
  '.zip',
  '.7z',
  '.rar',
  '.tar',
  '.gz',
  '.tgz',
  '.bz2',
  '.tbz',
  '.tbz2',
  '.xz',
  '.cab',
  '.iso',
  '.cbr',
  '.cbz',
  '.tar.gz',
  '.tar.bz2',
  '.tar.xz',
]);

export const FILE_ICON_DEFAULT = '📄';
export const FILE_ICONS = Object.freeze<Record<string, string>>({
  // 텍스트, 문서, 오피스 파일
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

  // 이미지 파일
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
  bmp: '🖼️',

  // 비디오 파일
  mp4: '🎬',
  avi: '🎬',
  mov: '🎬',
  mkv: '🎬',
  webm: '🎬',

  // 오디오 파일
  mp3: '🎵',
  wav: '🎵',
  flac: '🎵',
  ogg: '🎵',
  aac: '🎵',

  // 코드 파일
  js: '💻',
  ts: '💻',
  py: '💻',
  java: '💻',
  cpp: '💻',
  c: '💻',
  go: '💻',
  rs: '💻',

  // 스타일 파일
  css: '🎨',

  // 웹 파일
  html: '🌐',

  // 데이터 파일
  json: '📋',
  xml: '📋',
  yaml: '📋',
  yml: '📋',

  // 실행 파일
  exe: '⚙️',
  sh: '⚙️',
  bat: '⚙️',
});
