from <%= moduleName %> import index


def test_index():
    assert index.hello() == "Hello <%= projectName %>"
