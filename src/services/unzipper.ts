import type { FlatEntry, NestedArchiveEntries } from '@/types';
import type { UIManager, FileCollection } from '.';
import { Archive } from 'libarchive.js';
import { zip as zipAsync } from 'fflate';
import { isArchive, formatSize } from '@/utils';

export default class Unzipper {
  private static readonly MAX_DEPTH = 12;
  private readonly uiManager: UIManager;
  private readonly fileManager: FileCollection;

  constructor(uiManager: UIManager, fileManager: FileCollection) {
    this.uiManager = uiManager;
    this.fileManager = fileManager;
  }

  async runAsync(files: File[]): Promise<void> {
    this.fileManager.clear();
    this.uiManager.showProgressSection();

    try {
      this.uiManager.addLog('추출 시작...');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.uiManager.setProgress(i, files.length, file.name);
        this.uiManager.addLog(`\n[${i + 1}/${files.length}] ${file.name}`);

        try {
          await this.extractRecursiveAsync(file);
        } catch (error) {
          this.uiManager.addLog(`  Error: ${(error as Error).message}`, 'error');
          this.uiManager.showToast('파일 추출 도중 오류가 발생했습니다.', 'error');
          return;
        }
      }

      this.uiManager.setProgress(files.length, files.length, '완료');
      this.uiManager.addLog(`\n총 ${this.fileManager.size}개 파일 추출됨`, 'success');

      await this.buildResultAsync();
    } catch (error) {
      console.error(error);
      this.uiManager.addLog(`Error: ${(error as Error).message}`, 'error');
      this.uiManager.showToast('파일 추출 도중 오류가 발생했습니다.', 'error');
    }
  }

  private async extractRecursiveAsync(file: File, depth = 0): Promise<void> {
    if (depth > Unzipper.MAX_DEPTH) {
      this.uiManager.addLog(`  [건너뜀] 최대 재귀 깊이 초과: ${file.name}`, 'warning');
      return;
    }

    try {
      const archive = await Archive.open(file);

      try {
        const extracted = (await archive.extractFiles()) as NestedArchiveEntries;
        const entries = this.flattenEntries(extracted);

        this.uiManager.addLog(`  ${entries.length}개 항목 발견`);

        for (const { name, file: inner } of entries) {
          if (!inner || inner.size === 0) continue;

          if (isArchive(name)) {
            this.uiManager.addLog(`  → 내부 압축 파일: ${name}`, 'inner');
            await this.extractRecursiveAsync(inner, depth + 1);
          } else {
            const saved = this.fileManager.add(name, inner);
            this.uiManager.addLog(`  + ${saved} (${formatSize(inner.size)})`, 'success');
          }
        }
      } catch (error) {
        this.uiManager.addLog(`  [추출 실패] ${file.name}: ${(error as Error).message}`, 'error');
      }
    } catch (error) {
      this.uiManager.addLog(`  [열기 실패] ${file.name}: ${(error as Error).message}`, 'error');
    }
  }

  private async buildResultAsync(): Promise<void> {
    try {
      this.uiManager.addLog('\nZIP 생성 중...');

      const { data, url } = await this.buildZipAsync();

      this.uiManager.renderResult(this.fileManager, data.length, () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'extracted_files.zip';
        a.click();
      });

      this.uiManager.addLog('완료!', 'success');
    } catch (error) {
      console.error(error);
      this.uiManager.addLog(`Error: ${(error as Error).message}`, 'error');
      this.uiManager.showToast('ZIP 파일 생성 도중 오류가 발생했습니다.', 'error');
    }
  }

  private async buildZipAsync(): Promise<{ data: Uint8Array; url: string }> {
    const filesObj: Record<string, Uint8Array> = {};

    for (const [name, file] of this.fileManager.entries()) {
      const buffer = await file.arrayBuffer();
      filesObj[name] = new Uint8Array(buffer);
    }

    const data = await new Promise<Uint8Array>((resolve, reject) => {
      zipAsync(filesObj, { level: 0 }, (error, result) => (error ? reject(error) : resolve(result)));
    });

    const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));

    return { data, url };
  }

  private flattenEntries(obj: NestedArchiveEntries): FlatEntry[] {
    const output: FlatEntry[] = [];
    if (!obj || typeof obj !== 'object') return output;

    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof File) {
        output.push({ name: value.name || key, file: value });
      } else if (value && typeof value === 'object') {
        output.push(...this.flattenEntries(value as NestedArchiveEntries));
      }
    }

    return output;
  }
}
