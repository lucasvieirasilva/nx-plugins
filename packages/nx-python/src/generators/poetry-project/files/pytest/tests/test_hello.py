from <%= moduleName %>.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello <%= projectName %>"
