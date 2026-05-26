export default function Footer() {
  return (
    <footer className="border-border text-muted-foreground w-full border-t p-4 text-center sm:p-6">
      <div className="layout flex flex-col gap-y-3">
        <span className="whitespace-nowrap">© 2026 Gardendoe</span>

        <address className="leading-relaxed not-italic">
          문제가 있거나 도움이 필요하신 경우{' '}
          <a
            href="mailto:gardendoe@gmail.com"
            className="text-primary decoration-primary font-mono underline underline-offset-4 transition-opacity hover:opacity-80"
          >
            gardendoe@gmail.com
          </a>
          으로 알려주세요. 최대한 답변 드리겠습니다. 감사합니다 🌿
        </address>
      </div>
    </footer>
  );
}
