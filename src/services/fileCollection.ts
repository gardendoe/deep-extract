export default class FileCollection {
  private readonly files = new Map<string, File>();

  get size(): number {
    return this.files.size;
  }

  add(rawName: string, file: File): string {
    const name = rawName.split('/').filter(Boolean).pop() || rawName;

    if (!this.files.has(name)) {
      this.files.set(name, file);
      return name;
    }

    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : '';

    let n = 1;
    let candidate: string;

    do {
      candidate = `${base} (${n++})${extension}`;
    } while (this.files.has(candidate));

    this.files.set(candidate, file);

    return candidate;
  }

  clear(): void {
    this.files.clear();
  }

  entries(): IterableIterator<[string, File]> {
    return this.files.entries();
  }

  values(): IterableIterator<File> {
    return this.files.values();
  }
}
