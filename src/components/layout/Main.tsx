export default function Main({ children }: React.PropsWithChildren) {
  return (
    <main className="p-4 sm:p-6">
      <div className="layout flex flex-col gap-y-4">{children}</div>
    </main>
  );
}
