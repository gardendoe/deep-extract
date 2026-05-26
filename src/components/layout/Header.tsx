import Logo from '@/assets/logo.svg?react';

export default function Header() {
  return (
    <header className="border-border sticky inset-x-0 top-0 z-10 w-full border-b p-4 backdrop-blur-xl sm:p-6">
      <div className="layout flex flex-col gap-y-3">
        <h1 className="text-foreground w-fit text-2xl font-bold sm:text-3xl">
          <a href="/" className="flex items-center gap-3 rounded-md">
            <Logo />
            Deep Extract
          </a>
        </h1>

        <p className="text-muted-foreground leading-relaxed">
          ZIP 안의 ZIP, TAR 안의 7z까지 — 단 한 번의 클릭으로 중첩된 압축 파일들을 모두 깔끔하게 풀어드립니다.
        </p>
      </div>
    </header>
  );
}
