/** Invalid user input. The CLI prints the message and exits with status 1. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}
