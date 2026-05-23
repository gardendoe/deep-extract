import type { LogType, ToastType } from '@/types';
import type { DOMRegistry, FileCollection } from './';
import { FILE_ICONS, FILE_ICON_DEFAULT, formatSize } from '@/utils';
import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';

export default class UIManager {
  private readonly dom: DOMRegistry;

  constructor(dom: DOMRegistry) {
    this.dom = dom;
  }

  addLog(msg: string, type: LogType = 'default'): void {
    const div = document.createElement('div');
    if (type !== 'default') div.className = `log-${type}`;
    div.textContent = msg;
    this.dom.progressLog.appendChild(div);
    this.dom.progressLog.scrollTop = this.dom.progressLog.scrollHeight;
  }

  setProgress(current: number, total: number, label: string): void {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    this.dom.progressBar.style.width = `${percent}%`;
    this.dom.progressText.textContent = `${current}/${total}  ${label}`;
  }

  showToast(msg: string, type: ToastType = 'default'): void {
    const isError = type === 'error';

    Toastify({
      text: msg,
      duration: 5000,
      gravity: 'top',
      position: 'center',
      stopOnFocus: true,
      close: true,
      style: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '4px',
        background: 'var(--surface2)',
        border: `1px solid ${isError ? 'var(--error)' : 'var(--border-light)'}`,
        color: isError ? 'var(--error)' : 'var(--text)',
        padding: '0.75rem 1.25rem',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        maxWidth: '400px',
        cursor: 'default',
      },
    }).showToast();
  }

  updateFileCount(count: number): void {
    if (count === 0) {
      this.dom.fileCount.textContent = '';
      this.dom.extractBtn.disabled = true;
      this.dom.clearAllBtn.classList.add('hidden');
    } else {
      this.dom.fileCount.textContent = `${count}개 파일 선택됨`;
      this.dom.extractBtn.disabled = false;
      this.dom.clearAllBtn.classList.remove('hidden');
    }
  }

  showProgressSection(): void {
    this.dom.dropzone.classList.add('hidden');
    this.dom.actionRow.classList.add('hidden');
    this.dom.previewContainer.classList.add('locked');
    this.dom.progressSec.classList.remove('hidden');
    this.dom.resultSec.classList.add('hidden');
    this.dom.progressLog.innerHTML = '';
  }

  showUploadSection(): void {
    this.dom.dropzone.classList.remove('hidden');
    this.dom.actionRow.classList.remove('hidden');
    this.dom.previewContainer.classList.remove('locked');
    this.dom.progressSec.classList.add('hidden');
    this.dom.resultSec.classList.add('hidden');
    this.dom.progressLog.innerHTML = '';
  }

  renderResult(fileManager: FileCollection, zipSize: number, onDownload: () => void): void {
    const files = [...fileManager.values()];

    this.dom.resultList.innerHTML = files
      .map(({ name, size }) => {
        const ext = name.trim().toLowerCase().split('.').pop();
        const icon = (ext && FILE_ICONS[ext]) ?? FILE_ICON_DEFAULT;
        const resultFile = `
          <div class="result-file">
            <span class="file-icon">${icon}</span>
            <span class="file-name" title="${name}">${name}</span>
            <span class="file-size">${formatSize(size)}</span>
          </div>`;

        return resultFile;
      })
      .join('');

    this.dom.resultCount.textContent = `${fileManager.size}개 파일`;
    this.dom.resultSize.textContent = formatSize(zipSize);
    this.dom.downloadBtn.onclick = onDownload;
    this.dom.resultSec.classList.remove('hidden');
  }
}
