export default class DOMRegistry {
  readonly dropzone: HTMLDivElement;
  readonly uploadBtn: HTMLButtonElement;
  readonly previewContainer: HTMLUListElement;
  readonly previewTemplate: HTMLTemplateElement;
  readonly actionRow: HTMLDivElement;
  readonly fileCount: HTMLSpanElement;
  readonly clearAllBtn: HTMLButtonElement;
  readonly extractBtn: HTMLButtonElement;
  readonly progressSec: HTMLElement;
  readonly progressBar: HTMLDivElement;
  readonly progressText: HTMLSpanElement;
  readonly progressLog: HTMLDivElement;
  readonly resultSec: HTMLElement;
  readonly resultList: HTMLUListElement;
  readonly resultCount: HTMLSpanElement;
  readonly resultSize: HTMLSpanElement;
  readonly downloadBtn: HTMLButtonElement;
  readonly resetBtn: HTMLButtonElement;

  constructor() {
    this.dropzone = this.getElementById<HTMLDivElement>('dropzone-container');
    this.uploadBtn = this.getElementById<HTMLButtonElement>('dropzone-upload-btn');
    this.previewContainer = this.getElementById<HTMLUListElement>('file-preview-container');
    this.previewTemplate = this.getElementById<HTMLTemplateElement>('file-preview-template');
    this.actionRow = this.getElementById<HTMLDivElement>('action-row');
    this.fileCount = this.getElementById<HTMLSpanElement>('file-count');
    this.clearAllBtn = this.getElementById<HTMLButtonElement>('clear-all-btn');
    this.extractBtn = this.getElementById<HTMLButtonElement>('extract-btn');
    this.progressSec = this.getElementById<HTMLElement>('progress-section');
    this.progressBar = this.getElementById<HTMLDivElement>('progress-bar');
    this.progressText = this.getElementById<HTMLSpanElement>('progress-text');
    this.progressLog = this.getElementById<HTMLDivElement>('progress-log');
    this.resultSec = this.getElementById<HTMLElement>('result-section');
    this.resultList = this.getElementById<HTMLUListElement>('result-list');
    this.resultCount = this.getElementById<HTMLSpanElement>('result-count');
    this.resultSize = this.getElementById<HTMLSpanElement>('result-size');
    this.downloadBtn = this.getElementById<HTMLButtonElement>('download-btn');
    this.resetBtn = this.getElementById<HTMLButtonElement>('reset-btn');
  }

  private getElementById<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`#${id} 요소를 찾을 수 없습니다.`);
    return element as T;
  }
}
