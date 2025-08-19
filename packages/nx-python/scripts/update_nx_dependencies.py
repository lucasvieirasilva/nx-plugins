#!/usr/bin/env python3

"""
Automatically update implicitDependencies in Nx project.json files based on
actual imports.

This script analyzes Python files in each Nx project to find imports from other
local modules within the specified base directory and updates the implicitDependencies accordingly.
"""

import argparse
import json
import re
from pathlib import Path
from typing import TypedDict


def strip_jsonc_comments(jsonc_content: str) -> str:
    """
    Strip comments from JSONC content to make it valid JSON.

    This handles:
    - Single-line comments starting with //
    - Multi-line comments /* ... */

    Note: This is a simple implementation that may not handle all edge cases
    (like comments inside strings), but works for our project.json files.
    """
    lines = []
    in_multiline_comment = False

    for line in jsonc_content.split('\n'):
        if in_multiline_comment:
            # Look for end of multiline comment
            if '*/' in line:
                # Remove everything up to and including the */
                line = line[line.index('*/') + 2:]
                in_multiline_comment = False
            else:
                # Skip this entire line
                continue

        # Handle multiline comment start
        if '/*' in line:
            # Remove everything from /* onwards
            before_comment = line[:line.index('/*')]
            if '*/' in line[line.index('/*'):]:
                # Comment starts and ends on same line
                after_comment = line[line.index('*/') + 2:]
                line = before_comment + after_comment
            else:
                # Comment continues to next line
                line = before_comment
                in_multiline_comment = True

        # Handle single-line comments
        if '//' in line:
            # Remove everything from // onwards
            line = line[:line.index('//')]

        # Keep the line (even if it's now empty - we need to preserve structure)
        lines.append(line.rstrip())

    return '\n'.join(lines)


def parse_jsonc(file_path: Path) -> dict:
    """Parse a JSONC file by stripping comments and parsing as JSON."""
    with open(file_path, encoding='utf-8') as f:
        content = f.read()

    # Strip comments and parse as JSON
    json_content = strip_jsonc_comments(content)
    return json.loads(json_content)


def write_jsonc(file_path: Path, data: dict, original_content: str) -> None:
    """
    Write JSON data back to a JSONC file, preserving comments and formatting.

    This approach uses regex to replace the implicitDependencies array content
    while preserving the surrounding structure and comments.
    """
    new_deps = data.get('implicitDependencies', [])

    # Create the replacement dependencies array content with proper formatting
    if not new_deps:
        deps_content = '[]'
    else:
        # Find the indentation by looking at the original implicitDependencies line
        deps_match = re.search(r'^(\s*)"implicitDependencies"\s*:', original_content, re.MULTILINE)
        if deps_match:
            base_indent = deps_match.group(1)
            item_indent = base_indent + '    '  # Add 4 spaces for array items

            deps_lines = ['[']
            for i, dep in enumerate(new_deps):
                is_last = i == len(new_deps) - 1
                comma = '' if is_last else ','
                deps_lines.append(f'{item_indent}"{dep}"{comma}')
            deps_lines.append(f'{base_indent}  ]')
            deps_content = '\n'.join(deps_lines)
        else:
            # Fallback to simple format
            deps_content = json.dumps(new_deps, indent=2)

    # Use regex to replace the implicitDependencies array while preserving everything else
    # This pattern matches the entire implicitDependencies section including comments
    pattern = r'("implicitDependencies"\s*:\s*)\[[\s\S]*?\]'
    replacement = rf'\g<1>{deps_content}'

    new_content = re.sub(pattern, replacement, original_content, flags=re.MULTILINE | re.DOTALL)

    # Write the result back to the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)


class ProjectJson(TypedDict, total=False):
    implicitDependencies: list[str]


def find_nx_projects(base_dir: str) -> dict[str, Path]:
    """Find all Nx projects (directories with project.json files)."""
    projects = {}
    base_path = Path(base_dir)

    for project_json in base_path.glob('*/project.json'):
        project_dir = project_json.parent
        project_name = project_dir.name
        projects[project_name] = project_dir

    return projects


def find_python_files(project_dir: Path) -> list[Path]:
    """Find all Python files in a project directory."""
    return list(project_dir.glob('**/*.py'))


def extract_local_imports(file_path: Path, base_module: str) -> set[str]:
    """Extract local module imports from a Python file."""
    imports = set()

    try:
        with open(file_path, encoding='utf-8') as f:
            content = f.read()

        # Pattern to match: from base_module.module_name.something import ...
        # Escape the base_module for regex use
        escaped_base = re.escape(base_module)
        pattern = rf'from\s+{escaped_base}\.([^.\s]+)'
        matches = re.findall(pattern, content)
        imports.update(matches)

    except (UnicodeDecodeError, PermissionError) as e:
        print(f'Warning: Could not read {file_path}: {e}')

    return imports


def analyze_project_dependencies(project_name: str, project_dir: Path, all_projects: set[str], base_module: str) -> set[str]:
    """Analyze a project's dependencies based on its imports."""
    dependencies = set()

    # Find all Python files in the project
    python_files = find_python_files(project_dir)

    for py_file in python_files:
        # Extract local imports
        imports = extract_local_imports(py_file, base_module)

        # Filter to only include imports that correspond to other Nx projects
        for imported_module in imports:
            if imported_module in all_projects and imported_module != project_name:
                dependencies.add(imported_module)

    return dependencies


def update_project_json(project_dir: Path, dependencies: list[str]) -> bool:
    """Update the implicitDependencies in a project.json file."""
    project_json_path = project_dir / 'project.json'

    try:
        # Read the original content to preserve comments and formatting
        with open(project_json_path, encoding='utf-8') as f:
            original_content = f.read()

        # Parse the JSONC content
        project_data: ProjectJson = parse_jsonc(project_json_path)

        # Update implicitDependencies
        old_dependencies = project_data.get('implicitDependencies', [])
        project_data['implicitDependencies'] = sorted(dependencies)

        # Check if changes are needed
        if old_dependencies == sorted(dependencies):
            return False

        # Write back to file preserving comments and formatting
        write_jsonc(project_json_path, project_data, original_content)
        return True

    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f'Error updating {project_json_path}: {e}')
        return False

    except Exception as e:  # Catch any other unexpected errors
        print(f'Unexpected error updating {project_json_path}: {e}')
        return False


def main() -> None:
    """Main function to update all Nx project dependencies."""
    parser = argparse.ArgumentParser(
        description='Automatically update implicitDependencies in Nx project.json files based on actual imports.'
    )
    parser.add_argument(
        'base_dir',
        help='Base directory containing Nx projects (e.g., "my_monorepo" or "src")'
    )
    parser.add_argument(
        '--base-module',
        help='Base module name for imports (defaults to base_dir value)'
    )

    args = parser.parse_args()

    base_dir = args.base_dir
    base_module = args.base_module or base_dir

    print(f'🔍 Analyzing Nx projects in "{base_dir}" and their dependencies...')

    # Find all Nx projects
    projects = find_nx_projects(base_dir)
    all_project_names = set(projects.keys())

    print(f'Found {len(projects)} Nx projects: {", ".join(sorted(all_project_names))}')

    changes_made = 0

    # Analyze each project
    for project_name, project_dir in projects.items():
        print(f'\n📦 Analyzing project: {project_name}')

        # Find dependencies based on imports
        dependencies = analyze_project_dependencies(project_name, project_dir, all_project_names, base_module)
        dependencies_list = sorted(list(dependencies))

        print(f'   Dependencies found: {dependencies_list}')

        # Update project.json
        changed = update_project_json(project_dir, dependencies_list)
        if changed:
            print(f'   ✅ Updated {project_name}/project.json')
            changes_made += 1
        else:
            print(f'   ⏭️  No changes needed for {project_name}/project.json')

    print(f'\n🎉 Analysis complete! Updated {changes_made} project.json files.')

    if changes_made > 0:
        print('\n💡 Tip: Review the changes and commit them if they look correct.')
    else:
        print('\n✨ All implicitDependencies were already up to date!')


if __name__ == '__main__':
    main()
