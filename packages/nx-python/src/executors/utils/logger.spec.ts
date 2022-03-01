import { Logger } from "./logger"

describe('Executor logger', () => {

  let consoleSpy = null
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'info');
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should print the message in the console', () => {
    const logger = new Logger()
    logger.setOptions({
      silent: false
    })

    logger.info("hello")
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('hello')
    );
  })

  it('should print the message in the console when the options are not specified', () => {
    const logger = new Logger()

    logger.info("hello")
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('hello')
    );
  })

  it('should not print the message in the console when the options.silent is true', () => {
    const logger = new Logger()
    logger.setOptions({
      silent: true
    })

    logger.info("hello")
    expect(consoleSpy).not.toHaveBeenCalled();
  })
})
