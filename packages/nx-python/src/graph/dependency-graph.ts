import {
  joinPathFragments,
  ProjectConfiguration,
  ImplicitDependency,
  DependencyType,
} from '@nx/devkit';
import { readFileSync, existsSync } from 'fs';
import { parse } from '@iarna/toml';
import path from 'path';
import { CreateDependencies } from 'nx/src/utils/nx-plugin';

export type PyprojectTomlDependency =
  | string
  | {
      path?: string;
      version?: string;
      markers?: string;
      optional?: boolean;
      extras?: string[];
      develop?: boolean;
      git?: string;
      rev?: string;
      source?: string;
    };

export type PyprojectTomlDependencies = {
  [key: string]: PyprojectTomlDependency;
};

export type Dependency = {
  name: string;
  category: string;
};

export type PyprojectTomlSource = {
  name: string;
  url: string;
};

export type PyprojectToml = {
  tool?: {
    nx?: {
      autoActivate?: boolean;
    };
    poetry?: {
      name: string;
      version: string;
      packages?: Array<{
        include: string;
        from?: string;
      }>;
      dependencies?: PyprojectTomlDependencies;
      group?: {
        [key: string]: {
          dependencies: PyprojectTomlDependencies;
        };
      };
      extras?: {
        [key: string]: string[];
      };
      plugins?: {
        [key: string]: {
          [key: string]: string;
        };
      };
      source?: PyprojectTomlSource[];
    };
  };
};

export const getDependents = (
  projectName: string,
  projects: Record<string, ProjectConfiguration>,
  cwd: string,
): string[] => {
  const deps: string[] = [];

  const { root } = projects[projectName];

  for (const project in projects) {
    if (checkProjectIsDependent(projects, project, root, cwd)) {
      deps.push(project);
    }
  }

  return deps;
};

export const getDependencies = (
  projectName: string,
  projects: Record<string, ProjectConfiguration>,
  cwd: string,
): Dependency[] => {
  const projectData = projects[projectName];
  const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

  const deps: Dependency[] = [];

  if (existsSync(pyprojectToml)) {
    const tomlData = getPyprojectData(pyprojectToml);

    resolveDependencies(
      tomlData.tool?.poetry?.dependencies,
      projectData,
      projects,
      cwd,
      deps,
      'main',
    );
    for (const group in tomlData.tool?.poetry?.group || {}) {
      resolveDependencies(
        tomlData.tool.poetry.group[group].dependencies,
        projectData,
        projects,
        cwd,
        deps,
        group,
      );
    }
  }

  return deps;
};

const getPyprojectData = (pyprojectToml: string) => {
  const content = readFileSync(pyprojectToml).toString('utf-8');
  if (content.trim() === '') return {};

  return parse(readFileSync(pyprojectToml).toString('utf-8')) as PyprojectToml;
};

const checkProjectIsDependent = (
  projects: Record<string, ProjectConfiguration>,
  project: string,
  root: string,
  cwd: string,
): boolean => {
  const projectData = projects[project];
  const pyprojectToml = joinPathFragments(projectData.root, 'pyproject.toml');

  if (existsSync(pyprojectToml)) {
    const tomlData = getPyprojectData(pyprojectToml);

    let isDep = isProjectDependent(
      tomlData.tool?.poetry?.dependencies,
      projectData,
      root,
      cwd,
    );

    if (isDep) return true;

    for (const group in tomlData.tool?.poetry?.group || {}) {
      isDep = isProjectDependent(
        tomlData.tool.poetry.group[group].dependencies,
        projectData,
        root,
        cwd,
      );

      if (isDep) return true;
    }
  }

  return false;
};

const isProjectDependent = (
  dependencies: PyprojectTomlDependencies,
  projectData: ProjectConfiguration,
  root: string,
  cwd: string,
): boolean => {
  for (const dep in dependencies || {}) {
    const depData = dependencies[dep];

    if (depData instanceof Object && depData.path) {
      const depAbsPath = path.resolve(projectData.root, depData.path);

      if (
        path.normalize(root) === path.normalize(path.relative(cwd, depAbsPath))
      ) {
        return true;
      }
    }
  }
  return false;
};

const resolveDependencies = (
  dependencies: PyprojectTomlDependencies,
  projectData: ProjectConfiguration,
  projects: Record<string, ProjectConfiguration>,
  cwd: string,
  deps: Dependency[],
  category: string,
) => {
  for (const dep in dependencies || {}) {
    const depData = dependencies[dep];

    if (depData instanceof Object && depData.path) {
      const depAbsPath = path.resolve(projectData.root, depData.path);
      const depProjectName = Object.keys(projects).find(
        (proj) =>
          path.normalize(projects[proj].root) ===
          path.normalize(path.relative(cwd, depAbsPath)),
      );

      if (depProjectName) {
        deps.push({ name: depProjectName, category });
      }
    }
  }
};

export const createDependencies: CreateDependencies = (_, context) => {
  const result: ImplicitDependency[] = [];

  for (const project in context.projects) {
    const deps = getDependencies(project, context.projects, process.cwd());

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
