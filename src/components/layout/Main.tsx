export default function Main({ children }: React.PropsWithChildren) {
  return <main className="flex grow flex-col gap-y-4 p-4 sm:p-6">{children}</main>;
}
