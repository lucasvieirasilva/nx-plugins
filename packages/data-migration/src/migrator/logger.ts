import _ from 'lodash';
import chalk from 'chalk';

type ConsoleTypes = 'debug' | 'info' | 'warn' | 'error';

enum Levels {
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
}

export class CLILogger {
  private readonly logLevel: Levels = Levels.info;

  constructor(public readonly level: string) {
    const key = Object.entries(Levels).find(
      ([objectKey]) => objectKey === level
    );
    if (!_.isNil(key) && key.length > 0) {
      this.logLevel = key[1] as Levels;
    }
  }

  public info(message: string): void {
    this.logEntry(Levels.info, message);
  }

  public error(message?: string): void {
    this.logEntry(Levels.error, message);
  }

  public warn(message: string): void {
    this.logEntry(Levels.warn, message);
  }

  public debug(message: string): void {
    this.logEntry(Levels.debug, message);
  }

  private logEntry(level: Levels, message: string): void {
    if (this.logLevel <= level) {
      const levelStr = Levels[level] as ConsoleTypes;
      const currentTime = new Date().toISOString();
      const color = this.getLevelColor(level);
      const lv = color(`[${levelStr}]`.padEnd(7, ' '));

      console[levelStr](`${chalk.bold(`[${currentTime}]:${lv}`)} ${message}`);
    }
  }

  private getLevelColor(level: Levels) {
    switch (level) {
      case Levels.debug:
        return chalk.gray;
      case Levels.info:
        return chalk.blue;
      case Levels.warn:
        return chalk.yellow;
      case Levels.error:
        return chalk.red;
    }
  }
}
