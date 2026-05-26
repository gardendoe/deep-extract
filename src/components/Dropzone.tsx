import { useState, useCallback } from 'react';
import { type FileError, useDropzone } from 'react-dropzone';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { Upload, Archive, Trash2, Package } from 'lucide-react';
import { DragOverlay, Button, Card, Panel, List, Badge } from '@/components';
import {
  FILE_MAX_COUNT,
  FILE_MIN_SIZE,
  FILE_MAX_SIZE,
  ACCEPT_EXTENSIONS,
  EMOJI_ARCHIVE_DEFAULT,
  META_CHIPS,
  motionVariants,
  formatSize,
} from '@/lib';

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
  const extensions = Object.values(ACCEPT_EXTENSIONS).flat().join(', ');
  const clearAll = useCallback(() => setFiles([]), []);
  const removeFile = useCallback((name: string) => setFiles((prev) => prev.filter((file) => file.name !== name)), []);

  // Dropzone 옵션 구성
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    noClick: true,
    noKeyboard: true,
    multiple: true,
    maxFiles: FILE_MAX_COUNT,
    minSize: FILE_MIN_SIZE,
    maxSize: FILE_MAX_SIZE,
    accept: ACCEPT_EXTENSIONS,
    validator: (newFile) => {
      const isDuplicate = files.some((prevFile) => prevFile.name === newFile.name);
      return isDuplicate ? { code: 'file-duplicate', message: 'Duplicate file name' } : null;
    },
    onDrop: (acceptedFiles) => {
      setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    },
    onDropAccepted: (acceptedFiles) => {
      toast.success(`${acceptedFiles.length}개의 파일이 업로드되었습니다.`);
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
    <div className="relative flex grow flex-col" {...getRootProps()}>
      <input aria-hidden="true" {...getInputProps()} />

      {/* Drag Overlay (데스크톱 전용) */}
      <AnimatePresence>{isDragActive && <DragOverlay key="drag-overlay" />}</AnimatePresence>

      <AnimatePresence mode="wait">
        {fileCount > 0 ? (
          // Dropzone - compact
          <motion.div
            key="dropzone-compact"
            variants={motionVariants}
            initial={['hidden', 'down']}
            animate={['visible', 'center']}
            exit={['hidden', 'down']}
            className="layout flex flex-col gap-y-4"
          >
            <Button variant="dashed" size="large" className="bg-card" onClick={open}>
              <span className="bg-primary/15 text-primary inline-flex size-7 shrink-0 items-center justify-center rounded-lg">
                <Upload />
              </span>
              파일 추가
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

            {/* 압축 해제 버튼 */}
            <Button size="large" onClick={() => onExtract(files)}>
              <Package />
              <span>압축 해제하기</span>
              <span className="-ml-1 font-mono text-sm tabular-nums">({fileCount})</span>
            </Button>
          </motion.div>
        ) : (
          // Dropzone - full
          <motion.div
            key="dropzone-full"
            variants={motionVariants}
            initial={['hidden', 'up']}
            animate={['visible', 'center']}
            exit={['hidden', 'up']}
            className="layout flex grow flex-col justify-evenly gap-y-4"
          >
            <Card>
              <Button
                variant="dashed"
                aria-label="압축 파일 선택 (클릭 또는 드래그)"
                className="h-auto flex-col gap-4 border-2 py-12"
                onClick={open}
              >
                <Upload
                  aria-hidden="true"
                  className="group-hover/button:text-primary text-muted-foreground mb-1 size-14"
                />

                <p className="text-foreground text-xl whitespace-normal">
                  파일을 드래그하거나{' '}
                  <span className="text-primary decoration-primary underline underline-offset-4">클릭하여 선택</span>
                </p>

                <div className="flex flex-wrap justify-center gap-1.5">
                  {META_CHIPS.map(({ icon: Icon, label }) => (
                    <Badge key={label} variant="outlined">
                      <Icon className="size-3.5" />
                      <span>{label}</span>
                    </Badge>
                  ))}
                </div>
              </Button>
            </Card>

            {/* 안내 사항 */}
            <div className="flex flex-col items-center justify-center gap-y-8">
              <p className="text-center text-base leading-relaxed">
                <strong>지원되는 포맷</strong>:
                <br />
                <span className="text-primary">{extensions}</span>{' '}
                <span className="text-muted-foreground text-sm">(총 15개)</span>
              </p>

              <ul className="list-inside list-disc text-xs leading-loose sm:text-sm">
                <li>
                  한 번에 최대 <strong>20</strong>개, 파일당 <strong>2GB</strong>, 총 <strong>5GB</strong>까지 업로드할
                  수 있습니다.
                </li>
                <li>모든 처리는 브라우저 안에서만 이루어지며, 파일이 서버로 전송되지 않습니다.</li>
              </ul>

              <p className="text-error text-xs leading-relaxed sm:text-sm">
                * 암호가 걸린 압축 파일 및 분할 압축 파일(.z01 등)은 지원하지 않습니다.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
