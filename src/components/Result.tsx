import type { FailedZIP, FileMeta } from '@/types';
import { useMemo } from 'react';
import { Check, ChevronDown, RotateCcw, Download } from 'lucide-react';
import { Card, Button, Badge, Panel, List } from '@/components';
import { EMOJI_EXTENSIONS } from '@/constants';
import { getFileExtension, getEmoji, formatSize } from '@/utils';

type ResultProps = {
  succeeded: FileMeta[];
  failed: FailedZIP[];
  downloadUrl: string | null;
  onReset: () => void;
};

export default function Result({ succeeded, failed, downloadUrl, onReset }: ResultProps) {
  const totalSize = succeeded.reduce((total, file) => total + file.size, 0);

  const extensions = useMemo(() => {
    const extensionMap = new Map<string, number>();

    for (const file of succeeded) {
      const extension = getFileExtension(file.name);
      if (!extension) continue;
      extensionMap.set(extension, (extensionMap.get(extension) ?? 0) + 1);
    }

    return [...extensionMap.entries()];
  }, [succeeded]);

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'deep-extract-files.zip';
    a.click();
  };

  return (
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

      {/* 압축 해제 성공한 파일 목록 */}
      <Panel title={`${succeeded.length} files`} subtitle={formatSize(totalSize)}>
        <List>
          {succeeded.map((file) => (
            <List.Item key={file.name} name={file.name} size={file.size} emoji={getEmoji(file.name)} />
          ))}
        </List>
      </Panel>

      {/* 압축 해제 실패한 ZIP 목록 */}
      {failed.length > 0 && (
        <details className="border-border group overflow-hidden rounded-lg border font-mono text-xs">
          <summary className="bg-muted text-warning flex cursor-pointer list-none items-center justify-between px-4 py-2 select-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
              <span>실패 항목</span>
            </div>

            <span className="tabular-nums">{failed.length}개</span>
          </summary>

          <ul className="bg-background border-border flex flex-col gap-y-px border-t p-2">
            {failed.map((item, i) => (
              <li key={i} className="hover:bg-accent grid grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-md p-2 transition-colors">
                <span title={item.name} className="text-secondary-foreground truncate text-[0.78125rem]">
                  {item.name}
                </span>
                <span className="text-muted-foreground text-[0.78125rem] whitespace-nowrap">{item.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
