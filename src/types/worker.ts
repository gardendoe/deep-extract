/** 메인 스레드 → 워커 방향 메시지 */
export type WorkerInMsg =
  | { type: 'INIT'; sessionName: string }
  | { type: 'ADD_FILE'; name: string; size: number; stream: ReadableStream<Uint8Array> }
  | { type: 'FINALIZE' }
  | { type: 'CANCEL' };

/** 워커 → 메인 스레드 방향 메시지 */
export type WorkerOutMsg = WorkerFileMsg | WorkerResultMsg;

/** 파일 1개 처리에 대한 응답 메시지 */
export type WorkerFileMsg = { type: 'ACK' } | { type: 'FILE_ERROR'; message: string };

/** 전체 압축 작업에 대한 최종 응답 메시지 */
export type WorkerResultMsg = { type: 'DONE' } | { type: 'ERROR'; message: string };
