function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} 요소를 찾을 수 없습니다.`);
  return element as T;
}

export const dropZone = getElement<HTMLDivElement>('dropzone-container');
export const uploadBtn = getElement<HTMLButtonElement>('dropzone-upload-btn');
export const previewTemplate = getElement<HTMLTemplateElement>('file-preview-template');
export const previewContainer = getElement<HTMLUListElement>('file-preview-container');
export const fileCount = getElement<HTMLSpanElement>('file-count');
export const actionRow = getElement<HTMLDivElement>('action-row');
export const clearAllBtn = getElement<HTMLButtonElement>('clear-all-btn');
export const extractBtn = getElement<HTMLButtonElement>('extract-btn');
export const progressSec = getElement<HTMLElement>('progress-section');
export const progressBar = getElement<HTMLDivElement>('progress-bar');
export const progressText = getElement<HTMLSpanElement>('progress-text');
export const progressLogArea = getElement<HTMLDivElement>('progress-log-area');
export const resultSec = getElement<HTMLElement>('result-section');
export const resultCount = getElement<HTMLSpanElement>('result-count');
export const resultSize = getElement<HTMLSpanElement>('result-size');
export const resultList = getElement<HTMLUListElement>('result-list');
export const downloadBtn = getElement<HTMLButtonElement>('download-btn');
export const resetBtn = getElement<HTMLButtonElement>('reset-btn');
export const toast = getElement<HTMLDivElement>('toast');
