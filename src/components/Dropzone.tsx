import { useState, useCallback } from 'react';
import { type FileError, useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, Archive, Trash2, Package } from 'lucide-react';
import { ACCEPT_EXTENSIONS, FILE_MAX_COUNT, FILE_MAX_SIZE, FILE_MIN_SIZE, INPUT_MAX_TOTAL, EMOJI_ARCHIVE_DEFAULT } from '@/constants';
import { formatSize } from '@/utils';
import { DragOverlay, Button, Card, Panel, List } from '@/components';

type DropzoneProps = { onExtract: (files: File[]) => Promise<void> };

const errorMessages: Record<FileError['code'], string> = {
  'file-invalid-type': '지원하지 않는 파일 형식입니다.',
  'file-too-large': `파일 크기는 최대 ${formatSize(FILE_MAX_SIZE)} 이하여야 합니다.`,
  'file-too-small': `파일 크기는 최소 ${formatSize(FILE_MIN_SIZE)} 이상이어야 합니다.`,
  'too-many-files': `한 번에 최대 ${FILE_MAX_COUNT.toLocaleString()}개의 파일만 업로드 가능합니다.`,
};

export default function Dropzone({ onExtract }: DropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);

  const fileCount = files.length;
  const totalSize = files.reduce((total, file) => total + file.size, 0);

  const clearAll = useCallback(() => setFiles([]), []);
  const removeFile = useCallback((name: string) => setFiles((prev) => prev.filter((file) => file.name !== name)), []);

  // Dropzone 옵션 구성
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPT_EXTENSIONS,
    maxFiles: FILE_MAX_COUNT,
    maxSize: FILE_MAX_SIZE,
    minSize: FILE_MIN_SIZE,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      const totalSize = acceptedFiles.reduce((total, file) => total + file.size, 0);
      if (totalSize > INPUT_MAX_TOTAL) {
        toast.warning(`한 번에 최대 ${formatSize(INPUT_MAX_TOTAL)}까지 업로드 가능합니다.`);
        return;
      }

      setFiles(acceptedFiles);
    },
    onDropRejected: (rejections) => {
      const errorGroups: Record<FileError['code'], string[]> = {};

      for (const { errors, file } of rejections) {
        const error = errors.at(0);
        if (!error) return;
        (errorGroups[error.code] ??= []).push(file.name);
      }

      Object.entries(errorGroups).forEach(([errorCode, filenames]) => {
        const title = errorMessages[errorCode];
        const description = filenames.join(',\n');
        toast.warning(title, { description });
      });
    },
  });

  if (fileCount === 0) {
    return (
      <div className="relative" {...getRootProps()}>
        <input aria-hidden="true" {...getInputProps()} />

        {isDragActive && <DragOverlay />}

        <Card>
          <Button variant="dashed" aria-label="압축 파일 선택 (클릭 또는 드래그)" className="h-auto flex-col gap-4 border-2 py-12" onClick={open}>
            <Upload aria-hidden="true" className="group-hover/button:text-primary text-muted-foreground mb-1 size-14" />

            <p className="text-foreground text-xl whitespace-normal">
              ZIP 파일을 드래그하거나 <span className="text-primary decoration-primary underline underline-offset-4">클릭하여 선택</span>
            </p>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Button size="large" onClick={() => onExtract(files)}>
        <Package />
        <span>압축 해제하기</span>
        <span className="-ml-1 font-mono text-sm tabular-nums">({fileCount})</span>
      </Button>

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
              <List.Item key={file.name} name={file.name} size={file.size} emoji={EMOJI_ARCHIVE_DEFAULT} onRemove={() => removeFile(file.name)} />
            ))}
          </List>
        </Panel>
      </Card>
    </>
  );
}
