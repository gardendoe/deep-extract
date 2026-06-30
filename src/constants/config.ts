import type { Accept } from 'react-dropzone';

// OPFS 세션 폴더 접두사
export const OPFS_SESSION_PREFIX = 'dx';

// OPFS에 생성될 압축 결과물
export const OUTPUT_ZIP_NAME = 'output.zip';

// Dropzone Config
export const ACCEPT_EXTENSIONS = Object.freeze<Accept>({ 'application/zip': ['.zip'] }); // 허용되는 확장자
export const FILE_MAX_COUNT = 20; // ZIP 업로드 개수 상한
export const FILE_MIN_SIZE = 1_000; // 1KB - ZIP 크기 하한
export const FILE_MAX_SIZE = 5_000_000_000; // 5GB - ZIP 크기 상한
export const INPUT_MAX_TOTAL = 20_000_000_000; // 20GB — 총 입력(업로드) 크기 상한

// Zip bomb 방어
export const OUTPUT_MAX_TOTAL = 50_000_000_000; // 50GB — 총 출력(압축 해제) 크기 상한
export const ENTRY_MAX_UNCOMPRESSED = 10_000_000_000; // 10GB - 항목별 출력(압축 해제) 크기 상한
export const ENTRY_MAX_RATIO = 1_000; // 항목별 압축 비율 상한
export const ENTRIES_MAX_COUNT = 1_000; // ZIP 하나당 항목 개수 상한
