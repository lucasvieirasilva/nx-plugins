# Contribute to this project

## Got a Question?

Use [GitHub Discussions](https://github.com/lucasvieirasilva/nx-plugins/discussions) to ask questions, share ideas, or answer other people’s questions.

If you have a feature request or bug report, please file a GitHub issue instead of asking a question on Discussions.

## Found an Issue?

If you find a bug in the source code or a mistake in the documentation, you can help us
by [submitting an issue](https://github.com/lucasvieirasilva/nx-plugins/blob/main/CONTRIBUTING.md#submit-issue)
to [our GitHub Repository](https://github.com/lucasvieirasilva/nx-plugins). Even better, you
can [submit a Pull Request](https://github.com/lucasvieirasilva/nx-plugins/blob/main/CONTRIBUTING.md#submit-pr) with a fix.

## Building the Project

After cloning the project to your machine, to install the dependencies, run:

```bash
npm i
```

To build all the packages, run:

```bash
pnpm nx run-many --target=build --all
```

## Running Unit Tests

To make sure your changes do not break any unit tests, run the following:

```bash
nx affected --target=test
```

For example, if you need to only run the tests for the nx-python package, run:

```bash
nx test nx-python
```

## Testing the package in a local nx workspace

To test if your changes will actually work once the changes are published, you can use the `npm link` command to link the package to a local nx workspace.

- First, build the package:

```bash
nx run <project>:build
```

(e.g. `nx run nx-python:build`)

- Go to the dist folder of the package:

```bash
cd dist/packages/<project>
```

(e.g. `cd dist/packages/nx-python`)

- Link the package:

```bash
npm link
```

- Create a new nx workspace or use an existing one:

```bash
pnpm create-nx-workspace@latest
```

- Install the linked package (make sure you are in the root of the nx workspace):

```bash
npm link <package-name>
```

(e.g. `npm link @nxlv/python`)

**NOTE**: Make sure you are using the same package name as the one in the `package.json` file of the package you are testing.

## Submission Guidelines

### <a name="submit-issue"></a> Submitting an Issue

Before you submit an issue, please search the issue tracker. An issue for your problem may already exist and has been
resolved, or the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it. Having a
reproducible scenario gives us a wealth of important information without going back and forth with you requiring
additional information, such as:

- the output of `nx report`
- `yarn.lock` or `package-lock.json` or `pnpm-lock.yaml`
- and most importantly - a use-case that fails

A minimal reproduction allows us to quickly confirm a bug (or point out a coding problem) as well as confirm that we are
fixing the right problem.

You can file new issues by filling out our [issue form](https://github.com/nrwl/nx/issues/new/choose).

### <a name="submit-pr"></a> Submitting a PR

Please follow the following guidelines:

- Make sure unit tests pass (`nx affected --target=test`)
- Make sure you run `nx format`

#### Commitizen

To simplify and automate the process of committing with this format,
**This repository is a [Commitizen](https://github.com/commitizen/cz-cli) friendly repository**, just do `git add` and
execute `git commit`.
