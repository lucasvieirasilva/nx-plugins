import {
  PoetryPyprojectToml,
  PoetryPyprojectTomlDependencies,
} from '../../types';
import { Logger } from '../../../../executors/utils/logger';
import { BuildExecutorSchema } from '../../../../executors/build/schema';
import { ExecutorContext } from '@nx/devkit';

export abstract class BaseDependencyResolver {
  constructor(
    protected readonly logger: Logger,
    protected readonly options: BuildExecutorSchema,
    protected readonly context: ExecutorContext,
  ) {}

  protected getMainDependencyObject(
    pyproject: PoetryPyprojectToml,
  ): PoetryPyprojectTomlDependencies {
    return pyproject.tool?.poetry?.dependencies?.python
      ? pyproject.tool.poetry.dependencies
      : pyproject.tool.poetry.group.main.dependencies;
  }

  protected getPyProjectMainDependencies(pyproject: PoetryPyprojectToml) {
    return Object.entries(
      pyproject.tool?.poetry?.dependencies ??
        pyproject.tool?.poetry?.group?.main?.dependencies ??
        {},
    ).filter(([name]) => name != 'python');
  }
}
