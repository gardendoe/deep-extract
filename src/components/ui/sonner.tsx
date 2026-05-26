import { Toaster as Sonner, type ToasterProps } from 'sonner';

export default function Toaster(props: ToasterProps) {
  return <Sonner theme="dark" richColors expand position="top-center" {...props} />;
}
