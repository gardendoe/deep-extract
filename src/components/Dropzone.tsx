import { useState, useCallback } from 'react';
import { type FileError, useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, Archive, Trash2, Package } from 'lucide-react';
import { FILE_MAX_COUNT, FILE_MAX_SIZE, ACCEPT_EXTENSIONS, INPUT_MAX_TOTAL, EMOJI_ARCHIVE_DEFAULT } from '@/constants';
import { formatSize } from '@/utils';
import { DragOverlay, Button, Card, Panel, List } from '@/components';

type DropzoneProps = { onExtract: (files: File[]) => Promise<void> };

const errorMessages: Record<FileError['code'], string> = {
  'file-invalid-type': '지원하지 않는 파일 형식입니다',
  'file-too-large': '파일 크기는 최대 2GB 이하여야 합니다',
  'file-too-small': '파일 크기는 최소 1KB 이상이어야 합니다',
  'too-many-files': '한 번에 최대 20개의 파일만 업로드 가능합니다',

  // 커스텀 에러
  'file-duplicate': '이미 추가된 파일입니다',
};

export default function Dropzone({ onExtract }: DropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);

  const fileCount = files.length;
  const totalSize = files.reduce((total, file) => total + file.size, 0);
  const clearAll = useCallback(() => setFiles([]), []);
  const removeFile = useCallback((name: string) => setFiles((prev) => prev.filter((file) => file.name !== name)), []);

  // Dropzone 옵션 구성
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    noClick: true,
    noKeyboard: true,
    multiple: true,
    maxFiles: FILE_MAX_COUNT,
    maxSize: FILE_MAX_SIZE,
    accept: ACCEPT_EXTENSIONS,
    validator: (newFile) => {
      const isDuplicate = files.some((prevFile) => prevFile.name === newFile.name);
      return isDuplicate ? { code: 'file-duplicate', message: 'Duplicate file name' } : null;
    },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      const currentTotal = files.reduce((acc, f) => acc + f.size, 0);
      const currentCount = files.length;

      let remainingSize = INPUT_MAX_TOTAL - currentTotal;
      let remainingCount = FILE_MAX_COUNT - currentCount;

      const toAdd: File[] = [];
      const skipped: File[] = [];

      for (const file of acceptedFiles) {
        if (remainingCount <= 0 || file.size > remainingSize) {
          skipped.push(file);
        } else {
          toAdd.push(file);
          remainingSize -= file.size;
          remainingCount--;
        }
      }

      if (toAdd.length > 0) {
        setFiles((prev) => [...prev, ...toAdd]);
        toast.success(`${toAdd.length}개의 파일이 추가되었습니다.`);
      }

      if (skipped.length > 0) {
        toast.warning('일부 파일이 제외되었습니다', {
          description: `파일 수(20개) 또는 총 용량(2GB) 한도 초과: ${skipped.map((f) => f.name).join(', ')}`,
        });
      }
    },
    onDropRejected: (rejections) => {
      const errorGroups: Record<string, string[]> = {};

      for (const { errors, file } of rejections) {
        const error = errors.at(0);
        if (!error) return;
        (errorGroups[error.code] ??= []).push(file.name);
      }

      Object.entries(errorGroups).forEach(([errorCode, fileNames]) => {
        const title = errorMessages[errorCode];
        const description = fileNames.join(', ');

        toast.warning(`${title}:`, { description });
      });
    },
  });

  return (
    <>
      <div className="relative" {...getRootProps()}>
        <input aria-hidden="true" {...getInputProps()} />

        {/* Drag Overlay (데스크톱 전용) */}
        {isDragActive && <DragOverlay />}

        <Card>
          <Button
            variant="dashed"
            aria-label="압축 파일 선택 (클릭 또는 드래그)"
            className="h-auto flex-col gap-4 border-2 py-12"
            onClick={open}
          >
            <Upload aria-hidden="true" className="group-hover/button:text-primary text-muted-foreground mb-1 size-14" />

            <p className="text-foreground text-xl whitespace-normal">
              ZIP 파일을 드래그하거나{' '}
              <span className="text-primary decoration-primary underline underline-offset-4">클릭하여 선택</span>
            </p>
          </Button>
        </Card>
      </div>

      {fileCount > 0 && (
        <>
          {/* 압축 해제 버튼 */}
          <Button size="large" disabled={!fileCount} onClick={() => onExtract(files)}>
            <Package />
            <span>압축 해제하기</span>
            <span className="-ml-1 font-mono text-sm tabular-nums">({fileCount})</span>
          </Button>

          {/* 업로드 파일 리스트 */}
          <Card>
            <Card.Header
              title="압축 파일 목록"
              icon={<Archive />}
              extra={
                <Button variant="destructive" onClick={clearAll}>
                  <Trash2 />
                  전체 삭제
                </Button>
              }
            />

            <Panel title={`${fileCount} archives`} subtitle={formatSize(totalSize)}>
              <List className="max-h-90 overflow-y-auto">
                {files.map((file) => (
                  <List.Item
                    key={file.name}
                    name={file.name}
                    size={file.size}
                    emoji={EMOJI_ARCHIVE_DEFAULT}
                    onRemove={() => removeFile(file.name)}
                  />
                ))}
              </List>
            </Panel>
          </Card>
        </>
      )}
    </>
  );
}
