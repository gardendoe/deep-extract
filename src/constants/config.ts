import type { Accept } from 'react-dropzone';

// OPFS 세션 폴더 접두사
export const OPFS_SESSION_PREFIX = 'dx';

// OPFS에 생성될 압축 결과물 이름
export const OUTPUT_ZIP_NAME = 'output.zip';

// Dropzone Config
export const ACCEPT_EXTENSIONS = Object.freeze<Accept>({ 'application/zip': ['.zip'] }); // 허용되는 확장자
export const FILE_MAX_COUNT = 20; // ZIP 업로드 개수 상한
export const FILE_MAX_SIZE = 5_000_000_000; // 5GB - ZIP 크기 상한
export const INPUT_MAX_TOTAL = 20_000_000_000; // 20GB — 총 입력(업로드) 크기 상한
export const OUTPUT_MAX_TOTAL = 50_000_000_000; // 50GB — 총 출력(압축 해제) 크기 상한
export const ENTRY_MAX_DECOMPRESSED = 10_000_000_000; // 10GB - 항목별 출력(압축 해제) 크기 상한 (Zip Bomb 방어)
export const ENTRIES_MAX_COUNT = 3_000; // ZIP 하나당 항목 개수 상한 (Zip Bomb 방어)
