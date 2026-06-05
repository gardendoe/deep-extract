export default function Support() {
  return (
    <div className="flex flex-col items-center justify-center gap-y-8">
      <ul className="list-inside list-disc text-xs leading-loose sm:text-sm">
        <li>
          한 번에 최대 <strong>20</strong>개, 파일당 <strong>1GB</strong>, 총 <strong>2GB</strong>까지 업로드할 수
          있습니다.
        </li>
        <li>모든 처리는 브라우저 안에서만 이루어지며, 파일이 서버로 전송되지 않습니다.</li>
      </ul>

      <p className="text-error text-xs leading-relaxed sm:text-sm">
        * 암호가 걸린 압축 파일 및 분할 압축 파일(.z01 등)은 지원하지 않습니다.
      </p>
    </div>
  );
}
