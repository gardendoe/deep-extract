import { TriangleAlert } from 'lucide-react';
import { OPFS_SUPPORTED, WORKER_SUPPORTED } from '@/constants';

export default function Compatibility({ children }: React.PropsWithChildren) {
  return OPFS_SUPPORTED && WORKER_SUPPORTED ? (
    children
  ) : (
    <div className="flex flex-col items-center gap-y-4 py-16 text-center">
      <TriangleAlert className="fill-warning stroke-background size-20" />
      <p className="text-3xl leading-snug font-medium">지원되지 않는 브라우저입니다.</p>
      <p>브라우저를 최신 버전으로 업데이트한 후 다시 시도해 주세요.</p>
    </div>
  );
}
