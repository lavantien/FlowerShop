import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from strip_comments import strip_java, tokens

CASES = [
    ("int a; // tail\nint b;\n", "int a;\nint b;\n"),
    ("// whole line\nint a;\n", "int a;\n"),
    ("// c1\n// c2\nint a;\n", "int a;\n"),
    ("int a;\n/* block\n block2 */\nint b;\n", "int a;\nint b;\n"),
    ("/** javadoc\n * line\n */\nint a;\n", "int a;\n"),
    ("/**/int a;\n", "int a;\n"),
    ("int a; /* tail block */\nint b;\n", "int a;\nint b;\n"),
    ("int x = /* c */ 1;\n", "int x = 1;\n"),
    ("int /* k */x = 2;\n", "int x = 2;\n"),
    ("foo/* c */bar;\n", "foo bar;\n"),
    ("foo(/* c */ b);\n", "foo( b);\n"),
    ("  /* c */ int y;\n", "  int y;\n"),
    ("/* c */ int y;\n", "int y;\n"),
    ('String s = "// not /* here";\n', 'String s = "// not /* here";\n'),
    ("char q = '\"'; char a = '\\''; char b = '\\\\';\n",
     "char q = '\"'; char a = '\\''; char b = '\\\\';\n"),
    ('String t = """\n  // not a comment\n  /* nope */ x\n  """;\ntail();\n',
     'String t = """\n  // not a comment\n  /* nope */ x\n  """;\ntail();\n'),
    ('String e = "" + "" ; // gone\n', 'String e = "" + "" ;\n'),
    ("int a = 4/2;\nint b = a / 3;\n", "int a = 4/2;\nint b = a / 3;\n"),
    ("int a;\n// last line no newline", "int a;\n"),
    ("// only comments\n// here\n", ""),
    ("package p;\n\n// header\nimport a.A;\n", "package p;\n\nimport a.A;\n"),
    ("int a;   \t // sloppy tail\n", "int a;\n"),
    ("int a = 1 /* mid */ + 2;\n", "int a = 1 + 2;\n"),
    ("/* c */\r\nint a;\r\n", "int a;\r\n"),
    ("int a; // c\r\nint b;\r\n", "int a;\r\nint b;\r\n"),
    ("x(/* a */ /* b */ y);\n", "x( y);\n"),
    ("int a;\n\n/* blank above stays */\nint b;\n", "int a;\n\nint b;\n"),
    ("String url = \"http://x\"; // tail\n", "String url = \"http://x\";\n"),
]

failed = 0
for idx, (src, want) in enumerate(CASES):
    got, removed = strip_java(src)
    if got != want or tokens(src) != tokens(got):
        failed += 1
        print(f"case {idx} FAILED")
        print(f"  in:  {src!r}")
        print(f"  got: {got!r}")
        print(f"  want:{want!r}")
        print(f"  toks_equal: {tokens(src) == tokens(got)}")
print(f"cases={len(CASES)} failures={failed}")
sys.exit(1 if failed else 0)
