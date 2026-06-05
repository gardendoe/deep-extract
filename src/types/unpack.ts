export type LogType = 'line' | 'spacer';
export type LogLevel = 'default' | 'info' | 'success' | 'warning' | 'error';
export type LogEntry = {
  id: string;
  level: LogLevel;
  message: string;
};

/**
 * 압축 해제 방식 (TODO)
 * - flatten: 압축 파일 내의 모든 일반 파일들을 단일 디렉터리로 추출 (현재 기능)
 * - preserve: 원래의 디렉터리 구조를 유지한 채 압축만 해제 (향후 구현 예정)
 */
export type UnpackMode = 'flatten' | 'preserve';

/** 압축 해제 옵션 (TODO)
 * - mode: flatten/preserve
 * - encoding: 파일명 인코딩 설정 (UTF8...)
 */
export interface UnpackOptions {
  mode: UnpackMode;
  encoding: string;
}
