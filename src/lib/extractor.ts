import type { NestedArchiveEntries, FlatEntry, ExtractedFile, LogEntry, LogType } from '@/types';
import type { LogLevel, ExtractionOptions } from '@/types';
import { Archive } from 'libarchive.js';
import { isArchive, deduplicateName } from './file';

Archive.init({ workerUrl: '/worker-bundle.js' });

export type ExtractionCallbacks = {
  onLog: (level: LogLevel, message: string) => void;
  onProgress: (progress: number) => void;
  onFile: (file: ExtractedFile) => void;
};

/** libarchive.js의 중첩 객체 구조를 FlatEntry 배열로 평탄화 */
function flattenEntries(obj: NestedArchiveEntries): FlatEntry[] {
  const result: FlatEntry[] = [];
  if (!obj || typeof obj !== 'object') return result;

  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof File) {
      result.push({ name: value.name || key, file: value });
    } else if (value && typeof value === 'object') {
      result.push(...flattenEntries(value as NestedArchiveEntries));
    }
  }
  return result;
}

/** 단일 압축 파일을 재귀적으로 해제. 내부에 또 다른 압축 파일이 있으면 재귀 호출 */
async function extractRecursiveAsync(
  file: File,
  callbacks: ExtractionCallbacks,
  options: ExtractionOptions,
  usedNames: Set<string>,
  depth: number,
): Promise<void> {
  if (depth > options.maxDepth) {
    callbacks.onLog('warning', `[건너뜀] 최대 재귀 깊이(${options.maxDepth}) 초과: ${file.name}`);
    return;
  }

  const indent = `\t`.repeat(depth);

  try {
    const archive = await Archive.open(file);

    try {
      const extracted = (await archive.extractFiles()) as NestedArchiveEntries;
      const entries = flattenEntries(extracted);

      callbacks.onLog('default', `${indent}\t${entries.length}개 항목 발견`);

      for (const { name, file: inner } of entries) {
        if (!inner || inner.size === 0) continue;

        if (isArchive(name)) {
          callbacks.onLog('info', `${indent}\t↳ 내부 압축 파일: ${name}`);
          await extractRecursiveAsync(inner, callbacks, options, usedNames, depth + 1);
        } else {
          const finalName = deduplicateName(name, usedNames);
          usedNames.add(finalName);

          const renamedFile = finalName !== name ? new File([inner], finalName, { type: inner.type }) : inner;

          if (finalName !== name) {
            callbacks.onLog('warning', `${indent}\t! ${name} → ${finalName} (이름 중복으로 변경)`);
          } else {
            callbacks.onLog('success', `${indent}\t+ ${finalName}`);
          }

          callbacks.onFile({ name: finalName, size: renamedFile.size, file: renamedFile });
        }
      }
    } catch (error) {
      callbacks.onLog('error', `${indent}\t[추출 실패] ${file.name}: ${(error as Error).message}`);
    }
  } catch (error) {
    callbacks.onLog('error', `[열기 실패] ${file.name}: ${(error as Error).message}`);
  }
}

/**
 * 업로드된 압축 파일 목록을 순서대로 재귀 해제
 * 각 파일 완료 시 onProgress로 진행률(0~100)을 콜백
 */
export async function extractArchivesAsync(
  files: File[],
  options: ExtractionOptions,
  callbacks: ExtractionCallbacks,
): Promise<void> {
  const usedNames = new Set<string>();

  callbacks.onLog('default', '추출 시작...');

  for (let i = 0; i < files.length; i++) {
    callbacks.onLog('default', `\n[${i + 1}/${files.length}] ${files[i].name}`);
    await extractRecursiveAsync(files[i], callbacks, options, usedNames, 0);
    callbacks.onProgress(Math.round(((i + 1) / files.length) * 90)); // 90%까지 추출, 나머지 10%는 ZIP 생성
  }
}

export function writeLogs(logs: LogEntry[]): (LogEntry & { type: LogType })[] {
  return logs.flatMap((log) =>
    log.message.split('\n').map((line, index) => ({
      id: `${log.id}-${index}`,
      type: line ? 'line' : 'spacer',
      level: log.level,
      message: line,
    })),
  );
}
