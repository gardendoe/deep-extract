export class PolicySkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicySkipError';
  }
}
