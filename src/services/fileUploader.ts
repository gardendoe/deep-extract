import type { DOMRegistry, UIManager } from '.';
import Dropzone from 'dropzone';
import { ARCHIVE_EXTENSIONS } from '@/utils';

export default class FileUploader {
  private readonly dom: DOMRegistry;
  private readonly uiManager: UIManager;
  private readonly dropzone: Dropzone;
  private batchProcessing = false;
  private extractHandler?: (files: File[]) => Promise<void>;
  private resetHandler?: () => void;

  constructor(dom: DOMRegistry, uiManager: UIManager) {
    this.dom = dom;
    this.uiManager = uiManager;
    this.dropzone = new Dropzone(dom.dropzone, {
      url: '#',
      autoProcessQueue: false,
      previewsContainer: dom.previewContainer,
      previewTemplate: dom.previewTemplate.innerHTML,
      clickable: [dom.dropzone, dom.uploadBtn],
      acceptedFiles: [...ARCHIVE_EXTENSIONS].join(','),
    });

    this.setupListeners();
  }

  getAcceptedFiles(): Dropzone.DropzoneFile[] {
    return this.dropzone.getAcceptedFiles();
  }

  onExtract(handler: (files: File[]) => Promise<void>): void {
    this.extractHandler = handler;
  }

  onReset(handler: () => void): void {
    this.resetHandler = handler;
  }

  updateUI(): void {
    const fileCount = this.getAcceptedFiles().length;
    this.uiManager.updateFileCount(fileCount);
  }

  clearAll(): void {
    this.batchProcessing = true;
    this.dropzone.removeAllFiles(true);
    this.batchProcessing = false;
  }

  private setupListeners(): void {
    // Dropzone 이벤트
    this.dropzone.on('addedfiles', newFiles => {
      this.batchProcessing = true;

      const acceptedFiles = newFiles.filter(file => file.accepted);

      if (acceptedFiles.length === 0) {
        this.batchProcessing = false;
        return;
      }

      this.uiManager.showToast(`${acceptedFiles.length}개 파일이 추가되었습니다.`);

      const newFilesSet = new Set(acceptedFiles);
      const existingNames = new Set(
        this.getAcceptedFiles()
          .filter(file => !newFilesSet.has(file))
          .map(file => file.name),
      );

      const batchNames = new Set<string>();
      let duplicateCount = 0;

      for (const file of acceptedFiles) {
        if (existingNames.has(file.name) || batchNames.has(file.name)) {
          this.dropzone.removeFile(file);
          duplicateCount++;
        } else {
          batchNames.add(file.name);
        }
      }

      this.batchProcessing = false;

      if (duplicateCount > 0) {
        this.uiManager.showToast(`이름이 중복된 파일 ${duplicateCount}개는 제외되었습니다.`, 'error');
      }

      this.updateUI();
    });

    this.dropzone.on('error', (file, message) => {
      this.uiManager.showToast(`오류가 발생했습니다: ${file.name}: ${message}`, 'error');
    });

    this.dropzone.on('removedfile', () => {
      if (!this.batchProcessing) this.updateUI();
    });

    // 압축 해제 버튼, 전체 삭제 버튼, 처음으로 돌아가기 버튼
    this.dom.extractBtn.addEventListener('click', async () => {
      this.dom.extractBtn.disabled = true;
      await this.extractHandler?.(this.getAcceptedFiles());
    });

    this.dom.clearAllBtn.addEventListener('click', () => {
      this.clearAll();
      this.updateUI();
    });

    this.dom.resetBtn.addEventListener('click', () => {
      this.clearAll();
      this.resetHandler?.();
      this.updateUI();
    });
  }
}
