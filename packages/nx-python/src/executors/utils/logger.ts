interface ExecutorLoggerOption {
  silent: boolean;
}

export class Logger {
  private options: ExecutorLoggerOption | null;

  public setOptions(options: ExecutorLoggerOption) {
    this.options = options;
  }

  public info(message: unknown) {
    this.log(message, 'info');
  }

  private log(message: unknown, level: string) {
    if (!this.options?.silent) {
      console[level](message);
    }
  }
}
