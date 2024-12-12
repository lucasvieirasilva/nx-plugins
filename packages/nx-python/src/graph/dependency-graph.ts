import {
  ImplicitDependency,
  DependencyType,
  CreateDependencies,
} from '@nx/devkit';
import { getProvider } from '../provider';

export const createDependencies: CreateDependencies = async (_, context) => {
  const result: ImplicitDependency[] = [];
  const provider = await getProvider(context.workspaceRoot);

  for (const project in context.projects) {
    const deps = provider.getDependencies(
      project,
      context.projects,
      context.workspaceRoot,
    );

    deps.forEach((dep) => {
      result.push({
        source: project,
        target: dep.name,
        type: DependencyType.implicit,
      });
    });
  }
  return result;
};
