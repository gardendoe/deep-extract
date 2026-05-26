declare module 'libarchive.js' {
  export class Archive {
    static init(options: { workerUrl: string }): void;
    static open(file: File): Promise<Archive>;
    extractFiles(): Promise<Record<string, unknown>>;
  }
}
