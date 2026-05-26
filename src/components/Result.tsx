import type { ExtractedFile } from '@/types';
import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Check, RotateCcw, Download } from 'lucide-react';
import { Card, Button, Badge, Panel, List } from '@/components';
import { EMOJI_EXTENSIONS, motionVariants, getFileExtension, getEmoji, formatSize } from '@/lib';

type ResultProps = {
  files: ExtractedFile[];
  downloadUrl: string | null;
  onReset: () => void;
};

export default function Result({ files, downloadUrl, onReset }: ResultProps) {
  const totalSize = files.reduce((total, file) => total + file.size, 0);

  const extensions = useMemo(() => {
    const extensionMap = new Map<string, number>();

    for (const file of files) {
      const extension = getFileExtension(file.name);
      if (!extension) continue;
      extensionMap.set(extension, (extensionMap.get(extension) ?? 0) + 1);
    }

    return [...extensionMap.entries()];
  }, [files]);

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'deep-extract-files.zip';
    a.click();
  };

  return (
    <motion.div
      variants={motionVariants}
      initial={['hidden', 'down']}
      animate={['visible', 'center']}
      exit={['hidden', 'down']}
      className="layout"
    >
      <Card>
        <Card.Header
          variant="success"
          title="추출 완료"
          icon={<Check />}
          extra={
            <div className="flex items-center gap-1.5">
              <Button variant="outlined" onClick={onReset}>
                <RotateCcw />
                초기화
              </Button>
              <Button disabled={!downloadUrl} onClick={handleDownload}>
                <Download />
                ZIP 다운로드
              </Button>
            </div>
          }
        />

        {/* 파일 확장자 요약 칩 */}
        {extensions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {extensions.map(([extension, count]) => (
              <Badge key={extension} size="small" className="font-mono">
                <span>{EMOJI_EXTENSIONS[extension]}</span>
                <span>{extension}</span>
                <span className="ml-0.5 tabular-nums">{count}</span>
              </Badge>
            ))}
          </div>
        )}

        {/* 추출된 파일 목록 */}
        <Panel title={`${files.length} files`} subtitle={formatSize(totalSize)}>
          <List>
            {files.map((file) => (
              <List.Item key={file.name} name={file.name} size={file.size} emoji={getEmoji(file.name)} />
            ))}
          </List>
        </Panel>
      </Card>
    </motion.div>
  );
}
