// 브라우저 기능 지원 여부 (런타임 평가)
export const OPFS_SUPPORTED = 'storage' in navigator && typeof navigator.storage.getDirectory === 'function';
export const LOCK_SUPPORTED = 'locks' in navigator;
export const WORKER_SUPPORTED = typeof Worker !== 'undefined';
