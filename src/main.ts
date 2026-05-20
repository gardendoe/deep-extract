import type { LogFn } from './types';
import Dropzone from 'dropzone';
import { Archive } from 'libarchive.js';
import { zip as zipAsync } from 'fflate';
import { collectedFiles, extractRecursive, setProgress, showToast } from '@/features';
import {
  formatSize,
  dropZone,
  uploadBtn,
  previewTemplate,
  previewContainer,
  fileCount,
  actionRow,
  clearAllBtn,
  extractBtn,
  progressSec,
  progressLogArea,
  resultSec,
  resultCount,
  resultSize,
  resultList,
  downloadBtn,
  resetBtn,
  ARCHIVE_EXTENSIONS,
  FILE_ICONS,
  FILE_ICON_DEFAULT,
} from '@/utils';

Archive.init({ workerUrl: '/worker-bundle.js' });

let batchProcessing = false;

const dropzone = new Dropzone(dropZone, {
  url: '#',
  autoProcessQueue: false,
  previewsContainer: previewContainer,
  previewTemplate: previewTemplate.innerHTML,
  clickable: [dropZone, uploadBtn],
  acceptedFiles: [...ARCHIVE_EXTENSIONS].join(','),
});

// 드롭/선택 완료 후 일괄 유효성 검사
dropzone.on('addedfiles', newFiles => {
  batchProcessing = true;

  const validNewFiles = newFiles.filter(f => f.accepted !== false);
  if (validNewFiles.length === 0) return;

  const newFilesSet = new Set(validNewFiles);

  // 이미 목록에 존재하던 파일들의 이름 목록
  const existingNames = new Set(
    dropzone
      .getAcceptedFiles()
      .filter(f => !newFilesSet.has(f))
      .map(f => f.name),
  );

  const batchNames = new Set<string>();
  let duplicateCount = 0;

  for (const file of validNewFiles) {
    // 기존에 있던 파일명과 겹치거나, 이번에 같이 올린 파일명과 겹치면 제거
    if (existingNames.has(file.name) || batchNames.has(file.name)) {
      dropzone.removeFile(file);
      duplicateCount++;
    } else {
      batchNames.add(file.name);
    }
  }

  batchProcessing = false;

  if (duplicateCount > 0) {
    showToast(`이름이 중복된 파일 ${duplicateCount}개는 제외되었습니다.`, 'error');
  }

  updateUI();
});

// 개별 파일 제거 시 UI 업데이트 (remove 버튼 클릭)
dropzone.on('removedfile', () => {
  if (!batchProcessing) updateUI();
});

function updateUI(): void {
  const acceptedCount = dropzone.getAcceptedFiles().length;

  if (acceptedCount === 0) {
    fileCount.textContent = '';
    extractBtn.disabled = true;
    clearAllBtn.classList.add('hidden');
  } else {
    fileCount.textContent = `${acceptedCount}개 파일 선택됨`;
    extractBtn.disabled = false;
    clearAllBtn.classList.remove('hidden');
  }
}

// 압축 해제 진행
extractBtn.addEventListener('click', runExtraction);

async function runExtraction(): Promise<void> {
  const files = dropzone.getAcceptedFiles();

  extractBtn.disabled = true;
  dropZone.classList.add('hidden');
  actionRow.classList.add('hidden');
  previewContainer.classList.add('locked');
  collectedFiles.clear();

  progressSec.classList.remove('hidden');
  resultSec.classList.add('hidden');
  progressLogArea.innerHTML = '';

  const log: LogFn = (msg, type = 'default') => {
    const div = document.createElement('div');
    if (type !== 'default') div.className = `log-${type}`;
    div.textContent = msg;
    progressLogArea.appendChild(div);
    progressLogArea.scrollTop = progressLogArea.scrollHeight;
  };

  try {
    log('추출 시작...');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(i, files.length, file.name);
      log(`\n[${i + 1}/${files.length}] ${file.name}`);

      try {
        await extractRecursive(file, 0, log);
      } catch (error) {
        log(`  Error: ${(error as Error).message}`, 'error');
        showToast('파일 추출 도중 오류가 발생했습니다.', 'error');
        return;
      }
    }

    setProgress(files.length, files.length, '완료');
    log(`\n총 ${collectedFiles.size}개 파일 추출됨`, 'success');

    await buildResult(log);
  } catch (error) {
    console.error(error);
    log(`Error: ${(error as Error).message}`, 'error');
    showToast('파일 추출 도중 오류가 발생했습니다.', 'error');
  }
}

// ZIP 파일 생성 및 다운로드
async function buildResult(log: LogFn): Promise<void> {
  try {
    log('\nZIP 생성 중...');

    const filesObj: Record<string, Uint8Array> = {};
    for (const [name, file] of collectedFiles) {
      const buf = await file.arrayBuffer();
      filesObj[name] = new Uint8Array(buf);
    }

    const zipData = await new Promise<Uint8Array>((resolve, reject) => {
      zipAsync(filesObj, { level: 0 }, (error, data) => (error ? reject(error) : resolve(data)));
    });

    const blob = new Blob([zipData as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);

    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'extracted_files.zip';
      a.click();
    };

    const resultFiles = [...collectedFiles.values()];
    resultList.innerHTML = resultFiles
      .map(file => {
        const extension = file.name.trim().toLowerCase().split('.').pop();
        const fileIcon = (extension && FILE_ICONS[extension]) ?? FILE_ICON_DEFAULT;
        return `
        <div class="result-file">
          <span class="file-icon">${fileIcon}</span>
          <span class="file-name" title="${file.name}">${file.name}</span>
          <span class="file-size">${formatSize(file.size)}</span>
        </div>`;
      })
      .join('');

    resultCount.textContent = `${collectedFiles.size}개 파일`;
    resultSize.textContent = formatSize(zipData.length);
    resultSec.classList.remove('hidden');

    log('완료!', 'success');
  } catch (error) {
    console.error(error);
    log(`Error: ${(error as Error).message}`, 'error');
    showToast('ZIP 파일 생성 도중 오류가 발생했습니다.', 'error');
  }
}

resetBtn.addEventListener('click', () => {
  batchProcessing = true;
  dropzone.removeAllFiles(true);
  batchProcessing = false;
  collectedFiles.clear();

  dropZone.classList.remove('hidden');
  actionRow.classList.remove('hidden');
  previewContainer.classList.remove('locked');
  progressSec.classList.add('hidden');
  resultSec.classList.add('hidden');
  progressLogArea.innerHTML = '';

  updateUI();
});

clearAllBtn.addEventListener('click', () => {
  batchProcessing = true;
  dropzone.removeAllFiles(true);
  batchProcessing = false;
  updateUI();
});
