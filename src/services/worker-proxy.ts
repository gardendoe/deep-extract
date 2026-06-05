export default class WorkerProxy<TIn, TOut> {
  private readonly _worker: Worker;

  constructor(worker: Worker) {
    this._worker = worker;
  }

  postMessage(message: TIn, transfer?: Transferable[]): void {
    this._worker.postMessage(message, transfer ?? []);
  }

  set onmessage(handler: (event: MessageEvent<TOut>) => void) {
    this._worker.onmessage = handler;
  }

  set onerror(handler: (event: ErrorEvent) => void) {
    this._worker.onerror = handler;
  }

  terminate(): void {
    this._worker.terminate();
  }
}
