#!/usr/bin/env python3

"""
Tests for update_nx_dependencies.py script.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch
import pytest

# Import the functions we want to test
from update_nx_dependencies import (
    extract_local_imports,
    find_nx_projects,
    analyze_project_dependencies,
    update_project_json,
    parse_jsonc,
    strip_jsonc_comments,
    write_jsonc,
)


class TestExtractLocalImports:
    """Test the extract_local_imports function."""

    def test_extract_simple_imports(self, tmp_path):
        """Test extracting simple local imports."""
        # Create a test Python file
        test_file = tmp_path / "test.py"
        test_file.write_text("""
from myproject.module1 import something
from myproject.module2.submodule import another_thing
import myproject.module3
from external_package import external_thing
from myproject.module1.deep.nested import nested_func
""")

        imports = extract_local_imports(test_file, "myproject")
        # Note: "import myproject.module3" doesn't match our regex pattern
        # which looks for "from myproject.module_name" pattern
        expected = {"module1", "module2"}
        assert imports == expected

    def test_extract_no_imports(self, tmp_path):
        """Test file with no local imports."""
        test_file = tmp_path / "test.py"
        test_file.write_text("""
import os
import sys
from external_package import something
""")

        imports = extract_local_imports(test_file, "myproject")
        assert imports == set()

    def test_extract_direct_imports(self, tmp_path):
        """Test extracting direct imports (import module style)."""
        test_file = tmp_path / "test.py"
        test_file.write_text("""
import myproject.module1
import myproject.module2.submodule
from myproject.module3 import something
""")

        imports = extract_local_imports(test_file, "myproject")
        # Currently only captures "from" imports, not direct "import" statements
        expected = {"module3"}
        assert imports == expected

    def test_extract_with_special_characters_in_module(self, tmp_path):
        """Test base module names that need regex escaping."""
        test_file = tmp_path / "test.py"
        test_file.write_text("""
from my.project.module1 import something
from my.project.module2 import another
from other.project.module1 import external
""")

        imports = extract_local_imports(test_file, "my.project")
        expected = {"module1", "module2"}
        assert imports == expected

    def test_extract_invalid_file(self, tmp_path):
        """Test handling of unreadable files."""
        # Create a file that doesn't exist
        nonexistent_file = tmp_path / "nonexistent.py"

        # The function should handle FileNotFoundError gracefully
        # Need to catch the exception in the actual function
        imports = extract_local_imports(nonexistent_file, "myproject")
        assert imports == set()


class TestFindNxProjects:
    """Test the find_nx_projects function."""

    def test_find_projects(self, tmp_path):
        """Test finding Nx projects in a directory."""
        # Create test project structure
        (tmp_path / "project1" / "project.json").parent.mkdir(parents=True)
        (tmp_path / "project1" / "project.json").write_text('{"name": "project1"}')

        (tmp_path / "project2" / "project.json").parent.mkdir(parents=True)
        (tmp_path / "project2" / "project.json").write_text('{"name": "project2"}')

        # Create a directory without project.json (should be ignored)
        (tmp_path / "not_a_project").mkdir()
        (tmp_path / "not_a_project" / "some_file.txt").write_text("not a project")

        projects = find_nx_projects(str(tmp_path))

        assert len(projects) == 2
        assert "project1" in projects
        assert "project2" in projects
        assert projects["project1"] == tmp_path / "project1"
        assert projects["project2"] == tmp_path / "project2"

    def test_find_no_projects(self, tmp_path):
        """Test directory with no Nx projects."""
        # Create some directories but no project.json files
        (tmp_path / "dir1").mkdir()
        (tmp_path / "dir2").mkdir()

        projects = find_nx_projects(str(tmp_path))
        assert projects == {}


class TestAnalyzeProjectDependencies:
    """Test the analyze_project_dependencies function."""

    def test_analyze_dependencies(self, tmp_path):
        """Test analyzing project dependencies."""
        # Create project structure
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        # Create Python files with imports
        (project_dir / "main.py").write_text("""
from myproject.project2 import utils
from myproject.project3.handlers import handler
from external_lib import something
""")

        (project_dir / "subdir").mkdir()
        (project_dir / "subdir" / "helper.py").write_text("""
from myproject.project2.models import Model
from myproject.project4 import constants
""")

        all_projects = {"project1", "project2", "project3", "project4", "project5"}

        dependencies = analyze_project_dependencies("project1", project_dir, all_projects, "myproject")
        expected = {"project2", "project3", "project4"}
        assert dependencies == expected

    def test_analyze_no_dependencies(self, tmp_path):
        """Test project with no local dependencies."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        (project_dir / "main.py").write_text("""
import os
from external_lib import something
""")

        all_projects = {"project1", "project2"}

        dependencies = analyze_project_dependencies("project1", project_dir, all_projects, "myproject")
        assert dependencies == set()

    def test_analyze_self_dependency_ignored(self, tmp_path):
        """Test that self-dependencies are ignored."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        (project_dir / "main.py").write_text("""
from myproject.project1.utils import helper
from myproject.project2 import something
""")

        all_projects = {"project1", "project2"}

        dependencies = analyze_project_dependencies("project1", project_dir, all_projects, "myproject")
        assert dependencies == {"project2"}


class TestJsoncHandling:
    """Test JSONC parsing and writing functions."""

    def test_strip_single_line_comments(self):
        """Test stripping single-line comments."""
        jsonc_content = '''
{
  "name": "test", // This is a comment
  "dependencies": [] // Another comment
}
'''
        result = strip_jsonc_comments(jsonc_content)
        expected = '''
{
  "name": "test",
  "dependencies": []
}
'''
        assert result == expected

    def test_strip_multiline_comments(self):
        """Test stripping multi-line comments."""
        jsonc_content = '''
{
  "name": "test", /* This is a
  multiline comment */
  "dependencies": []
}
'''
        result = strip_jsonc_comments(jsonc_content)
        lines = result.split('\n')
        # Should preserve structure but remove comment content
        assert '"name": "test",' in result
        assert '"dependencies": []' in result
        assert 'multiline comment' not in result

    def test_strip_complex_multiline_comments(self):
        """Test stripping multi-line comments that span many lines."""
        jsonc_content = '''
{
  /* This is a long
     multiline comment
     that spans multiple lines
     and should be completely removed */
  "name": "test",
  "deps": []
}
'''
        result = strip_jsonc_comments(jsonc_content)
        # Should preserve structure but remove all comment content
        assert '"name": "test",' in result
        assert '"deps": []' in result
        assert 'multiline comment' not in result
        assert 'spans multiple lines' not in result

    def test_strip_same_line_multiline_comments(self):
        """Test comments that start and end on the same line."""
        jsonc_content = '''
{
  "name": /* inline comment */ "test",
  "deps": []
}
'''
        result = strip_jsonc_comments(jsonc_content)
        # Should preserve structure but remove comment
        assert '"name":  "test",' in result
        assert '"deps": []' in result
        assert 'inline comment' not in result

    def test_parse_jsonc(self, tmp_path):
        """Test parsing JSONC files."""
        jsonc_file = tmp_path / "test.json"
        jsonc_file.write_text('''
{
  "name": "test-project", // Project name
  "implicitDependencies": [
    "project1", // First dependency
    "project2"
  ]
}
''')

        data = parse_jsonc(jsonc_file)
        expected = {
            "name": "test-project",
            "implicitDependencies": ["project1", "project2"]
        }
        assert data == expected


class TestUpdateProjectJson:
    """Test updating project.json files."""

    def test_update_project_json(self, tmp_path):
        """Test updating implicitDependencies in project.json."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        project_json = project_dir / "project.json"
        original_content = '''{
  "name": "project1",
  "implicitDependencies": [
    "old-dependency"
  ],
  "targets": {}
}'''
        project_json.write_text(original_content)

        new_dependencies = ["new-dep1", "new-dep2"]
        result = update_project_json(project_dir, new_dependencies)

        assert result is True  # Changes were made

        # Verify the file was updated
        updated_data = parse_jsonc(project_json)
        assert updated_data["implicitDependencies"] == ["new-dep1", "new-dep2"]
        assert updated_data["name"] == "project1"  # Other fields preserved

    def test_update_project_json_no_changes(self, tmp_path):
        """Test when no changes are needed."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        project_json = project_dir / "project.json"
        original_content = '''{
  "name": "project1",
  "implicitDependencies": [
    "dep1",
    "dep2"
  ]
}'''
        project_json.write_text(original_content)

        # Same dependencies in different order
        new_dependencies = ["dep2", "dep1"]
        result = update_project_json(project_dir, new_dependencies)

        assert result is False  # No changes needed (sorted order is same)

    def test_update_project_json_with_comments(self, tmp_path):
        """Test that comments are preserved when updating."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        project_json = project_dir / "project.json"
        original_content = '''{
  "name": "project1", // Project name
  "implicitDependencies": [
    "old-dep" // Old dependency
  ],
  // Some other comment
  "targets": {}
}'''
        project_json.write_text(original_content)

        new_dependencies = ["new-dep"]
        result = update_project_json(project_dir, new_dependencies)

        assert result is True

        # Verify comments are preserved
        updated_content = project_json.read_text()
        assert "// Project name" in updated_content
        assert "// Some other comment" in updated_content

        # Verify data is correct
        updated_data = parse_jsonc(project_json)
        assert updated_data["implicitDependencies"] == ["new-dep"]

    def test_update_project_json_empty_dependencies(self, tmp_path):
        """Test updating with empty dependencies list."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        project_json = project_dir / "project.json"
        original_content = '''{
  "name": "project1",
  "implicitDependencies": [
    "old-dep1",
    "old-dep2"
  ]
}'''
        project_json.write_text(original_content)

        # Set empty dependencies
        new_dependencies = []
        result = update_project_json(project_dir, new_dependencies)

        assert result is True

        # Verify the empty array is formatted correctly
        updated_content = project_json.read_text()
        assert '"implicitDependencies": []' in updated_content

        # Verify data is correct
        updated_data = parse_jsonc(project_json)
        assert updated_data["implicitDependencies"] == []

    def test_update_project_json_no_indent_match(self, tmp_path):
        """Test fallback formatting when indentation pattern isn't found."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        project_json = project_dir / "project.json"
        # Unusual formatting that won't match the regex
        original_content = '''{"name":"project1","implicitDependencies":["old"],"targets":{}}'''
        project_json.write_text(original_content)

        new_dependencies = ["new-dep1", "new-dep2"]
        result = update_project_json(project_dir, new_dependencies)

        assert result is True

        # Verify data is correct even with fallback formatting
        updated_data = parse_jsonc(project_json)
        assert updated_data["implicitDependencies"] == ["new-dep1", "new-dep2"]

    def test_update_project_json_missing_implicit_dependencies(self, tmp_path):
        """Test adding implicitDependencies when the field doesn't exist."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        project_json = project_dir / "project.json"
        # Project.json without implicitDependencies field
        original_content = '''{
  "name": "project1",
  "projectType": "library",
  "targets": {}
}'''
        project_json.write_text(original_content)

        new_dependencies = ["new-dep1", "new-dep2"]
        result = update_project_json(project_dir, new_dependencies)

        assert result is True

        # Verify the field was added
        updated_content = project_json.read_text()
        assert '"implicitDependencies":' in updated_content

        # Verify data is correct
        updated_data = parse_jsonc(project_json)
        assert updated_data["implicitDependencies"] == ["new-dep1", "new-dep2"]
        assert updated_data["name"] == "project1"  # Other fields preserved

    def test_update_project_json_invalid_json(self, tmp_path, capsys):
        """Test handling of invalid JSON in project.json."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        project_json = project_dir / "project.json"
        # Invalid JSON content
        project_json.write_text('{ "name": "project1", invalid json }')

        new_dependencies = ["new-dep"]
        result = update_project_json(project_dir, new_dependencies)

        assert result is False

        # Check that error was printed
        captured = capsys.readouterr()
        assert "Error updating" in captured.out
        assert str(project_json) in captured.out

    def test_update_project_json_missing_file(self, tmp_path, capsys):
        """Test handling of missing project.json file."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        # Don't create project.json file

        new_dependencies = ["new-dep"]
        result = update_project_json(project_dir, new_dependencies)

        assert result is False

        # Check that error was printed
        captured = capsys.readouterr()
        assert "Error updating" in captured.out

    def test_update_project_json_unexpected_error(self, tmp_path, capsys, monkeypatch):
        """Test handling of unexpected errors during update."""
        project_dir = tmp_path / "project1"
        project_dir.mkdir()

        project_json = project_dir / "project.json"
        project_json.write_text('{"name": "project1", "implicitDependencies": []}')

        # Mock write_jsonc to raise an unexpected exception
        def mock_write_jsonc(*args, **kwargs):
            raise RuntimeError("Unexpected error")

        monkeypatch.setattr('update_nx_dependencies.write_jsonc', mock_write_jsonc)

        new_dependencies = ["new-dep"]
        result = update_project_json(project_dir, new_dependencies)

        assert result is False

        # Check that unexpected error was printed
        captured = capsys.readouterr()
        assert "Unexpected error updating" in captured.out
        assert "Unexpected error" in captured.out


class TestEndToEnd:
    """End-to-end integration tests."""

    def test_complete_workflow(self, tmp_path):
        """Test the complete dependency detection workflow."""
        # Create a mock monorepo structure
        base_dir = tmp_path / "myproject"
        base_dir.mkdir()

        # Project 1: depends on project2 and project3
        project1_dir = base_dir / "project1"
        project1_dir.mkdir()
        (project1_dir / "project.json").write_text('''{
  "name": "project1",
  "implicitDependencies": []
}''')
        (project1_dir / "main.py").write_text("""
from myproject.project2.utils import helper
from myproject.project3 import constants
from external_lib import something
""")

        # Project 2: depends on project3
        project2_dir = base_dir / "project2"
        project2_dir.mkdir()
        (project2_dir / "project.json").write_text('''{
  "name": "project2",
  "implicitDependencies": []
}''')
        (project2_dir / "utils.py").write_text("""
from myproject.project3.models import Model
""")

        # Project 3: no dependencies
        project3_dir = base_dir / "project3"
        project3_dir.mkdir()
        (project3_dir / "project.json").write_text('''{
  "name": "project3",
  "implicitDependencies": []
}''')
        (project3_dir / "constants.py").write_text("""
VALUE = 42
""")

        # Run the analysis
        projects = find_nx_projects(str(base_dir))
        all_project_names = set(projects.keys())

        # Analyze dependencies for each project
        for project_name, project_dir in projects.items():
            dependencies = analyze_project_dependencies(
                project_name, project_dir, all_project_names, "myproject"
            )
            dependencies_list = sorted(list(dependencies))
            update_project_json(project_dir, dependencies_list)

        # Verify the results
        project1_data = parse_jsonc(projects["project1"] / "project.json")
        project2_data = parse_jsonc(projects["project2"] / "project.json")
        project3_data = parse_jsonc(projects["project3"] / "project.json")

        assert set(project1_data["implicitDependencies"]) == {"project2", "project3"}
        assert project2_data["implicitDependencies"] == ["project3"]
        assert project3_data["implicitDependencies"] == []


class TestMainFunction:
    """Test the main function and command-line interface."""

    def test_main_function_basic(self, tmp_path, monkeypatch, capsys):
        """Test main function with basic arguments."""
        # Create a mock project structure
        base_dir = tmp_path / "myproject"
        base_dir.mkdir()

        project1_dir = base_dir / "project1"
        project1_dir.mkdir()
        (project1_dir / "project.json").write_text('{"name": "project1", "implicitDependencies": []}')
        (project1_dir / "main.py").write_text("from myproject.project2 import utils")

        project2_dir = base_dir / "project2"
        project2_dir.mkdir()
        (project2_dir / "project.json").write_text('{"name": "project2", "implicitDependencies": []}')
        (project2_dir / "utils.py").write_text("# utility functions")

        # Mock sys.argv to simulate command line arguments
        test_args = ["update_nx_dependencies.py", str(base_dir)]
        monkeypatch.setattr("sys.argv", test_args)

        # Import and run main function
        from update_nx_dependencies import main
        main()

        # Check output
        captured = capsys.readouterr()
        assert f'Analyzing Nx projects in "{base_dir}"' in captured.out
        assert "Found 2 Nx projects" in captured.out
        assert "project1, project2" in captured.out
        assert "Analysis complete!" in captured.out

    def test_main_function_with_base_module(self, tmp_path, monkeypatch, capsys):
        """Test main function with custom base module."""
        # Create a mock project structure
        base_dir = tmp_path / "src"
        base_dir.mkdir()

        project1_dir = base_dir / "project1"
        project1_dir.mkdir()
        (project1_dir / "project.json").write_text('{"name": "project1", "implicitDependencies": []}')
        (project1_dir / "main.py").write_text("from mycompany.project2 import utils")

        project2_dir = base_dir / "project2"
        project2_dir.mkdir()
        (project2_dir / "project.json").write_text('{"name": "project2", "implicitDependencies": []}')

        # Mock sys.argv with custom base module
        test_args = ["update_nx_dependencies.py", str(base_dir), "--base-module", "mycompany"]
        monkeypatch.setattr("sys.argv", test_args)

        from update_nx_dependencies import main
        main()

        captured = capsys.readouterr()
        assert f'Analyzing Nx projects in "{base_dir}"' in captured.out
        assert "Updated 1 project.json files" in captured.out

    def test_main_function_no_projects(self, tmp_path, monkeypatch, capsys):
        """Test main function with directory containing no projects."""
        # Create empty directory
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()

        test_args = ["update_nx_dependencies.py", str(empty_dir)]
        monkeypatch.setattr("sys.argv", test_args)

        from update_nx_dependencies import main
        main()

        captured = capsys.readouterr()
        assert "Found 0 Nx projects" in captured.out
        assert "Updated 0 project.json files" in captured.out

    def test_main_function_no_changes_needed(self, tmp_path, monkeypatch, capsys):
        """Test main function when no changes are needed."""
        base_dir = tmp_path / "myproject"
        base_dir.mkdir()

        project1_dir = base_dir / "project1"
        project1_dir.mkdir()
        # Project with no imports and no dependencies
        (project1_dir / "project.json").write_text('{"name": "project1", "implicitDependencies": []}')
        (project1_dir / "main.py").write_text("import os\nprint('hello')")  # No local imports

        project2_dir = base_dir / "project2"
        project2_dir.mkdir()
        (project2_dir / "project.json").write_text('{"name": "project2", "implicitDependencies": []}')
        (project2_dir / "utils.py").write_text("import sys")  # No local imports

        test_args = ["update_nx_dependencies.py", str(base_dir)]
        monkeypatch.setattr("sys.argv", test_args)

        from update_nx_dependencies import main
        main()

        captured = capsys.readouterr()
        assert "Updated 0 project.json files" in captured.out
        assert "All implicitDependencies were already up to date!" in captured.out

    def test_main_function_help(self, monkeypatch, capsys):
        """Test main function help output."""
        test_args = ["update_nx_dependencies.py", "--help"]
        monkeypatch.setattr("sys.argv", test_args)

        from update_nx_dependencies import main

        # argparse will call sys.exit() for --help
        with pytest.raises(SystemExit) as exc_info:
            main()

        assert exc_info.value.code == 0  # Successful exit

    def test_script_execution_as_main(self, tmp_path, monkeypatch):
        """Test running the script directly as __main__."""
        # Create a simple project structure
        base_dir = tmp_path / "testproject"
        base_dir.mkdir()

        project1_dir = base_dir / "project1"
        project1_dir.mkdir()
        (project1_dir / "project.json").write_text('{"name": "project1", "implicitDependencies": []}')

        # Mock sys.argv
        test_args = ["update_nx_dependencies.py", str(base_dir)]
        monkeypatch.setattr("sys.argv", test_args)

        # Import the module and test the __main__ functionality by calling main directly
        # This tests the same code path as if __name__ == '__main__': main()
        from update_nx_dependencies import main
        main()


if __name__ == "__main__":
    pytest.main([__file__])
