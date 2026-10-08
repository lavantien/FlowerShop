import sys
from pathlib import Path

WS = " \t\f\r"


def scan_string(src, i):
    """Consume a string literal starting at src[i] == '"'. Returns end index."""
    j = i + 1
    n = len(src)
    while j < n:
        c = src[j]
        if c == "\\":
            j += 2
        elif c == '"':
            return j + 1
        elif c == "\n":
            raise ValueError(f"unterminated string at {i}")
        else:
            j += 1
    raise ValueError(f"unterminated string at {i}")


def is_text_block(src, i):
    """JLS: a text block opens with \"\"\" + optional horizontal ws + newline."""
    if not src.startswith('"""', i):
        return False
    j = i + 3
    n = len(src)
    while j < n and src[j] in " \t\f":
        j += 1
    if j < n and src[j] == "\r":
        j += 1
    return j < n and src[j] == "\n"


def scan_text_block(src, i):
    """Consume a text block starting at its opening quote. Returns end index."""
    j = i + 3
    n = len(src)
    while j < n and src[j] in " \t\f\r":
        j += 1
    if j < n and src[j] == "\n":
        j += 1
    while j < n:
        if src[j] == "\\":
            j += 2
        elif src.startswith('"""', j):
            return j + 3
        else:
            j += 1
    raise ValueError(f"unterminated text block at {i}")


def scan_char(src, i):
    """Consume a char literal starting at src[i] == "'". Returns end index."""
    j = i + 1
    n = len(src)
    while j < n:
        c = src[j]
        if c == "\\":
            j += 2
        elif c == "'":
            return j + 1
        elif c == "\n":
            raise ValueError(f"unterminated char literal at {i}")
        else:
            j += 1
    raise ValueError(f"unterminated char literal at {i}")


def line_start(out):
    """Index in out where the current (incomplete) line begins."""
    for k in range(len(out) - 1, -1, -1):
        if out[k] == "\n":
            return k + 1
    return 0


def rstrip_line(out):
    k = len(out) - 1
    while k >= 0 and out[k] in " \t":
        k -= 1
    del out[k + 1:]


def strip_java(src):
    """Return (stripped_text, comments_removed). Raises ValueError on bad input."""
    out = []
    removed = 0
    i = 0
    n = len(src)
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if c == "/" and nxt == "/":
            e = i + 2
            while e < n and src[e] != "\n":
                e += 1
            removed += 1
            ls = line_start(out)
            if "".join(out[ls:]).strip() == "":
                del out[ls:]
                i = e + 1 if e < n else e
            else:
                rstrip_line(out)
                if src[e - 1] == "\r":
                    e -= 1
                i = e
        elif c == "/" and nxt == "*":
            e = i + 2
            while True:
                if e >= n - 1:
                    raise ValueError(f"unterminated block comment at {i}")
                if src[e] == "*" and src[e + 1] == "/":
                    e += 2
                    break
                e += 1
            removed += 1
            ls = line_start(out)
            before_blank = "".join(out[ls:]).strip() == ""
            nl = src.find("\n", e)
            rest = src[e:] if nl == -1 else src[e:nl]
            if before_blank and rest.strip() == "":
                del out[ls:]
                i = nl + 1 if nl != -1 else e
            elif rest.strip() == "":
                rstrip_line(out)
                k = e
                while k < nl and src[k] in " \t":
                    k += 1
                i = k if k != -1 else e
            else:
                prev_ws = len(out) == 0 or out[-1] in " \t" or out[-1] == "\n"
                if prev_ws:
                    k = e
                    while k < n and src[k] in " \t":
                        k += 1
                    i = k
                elif e < n and src[e] not in " \t\r\n":
                    out.append(" ")
                    i = e
                else:
                    i = e
        elif c == '"':
            e = scan_text_block(src, i) if is_text_block(src, i) else scan_string(src, i)
            out.extend(src[i:e])
            i = e
        elif c == "'":
            e = scan_char(src, i)
            out.extend(src[i:e])
            i = e
        else:
            out.append(c)
            i += 1
    return "".join(out), removed


def tokens(src):
    """Token stream with comments and whitespace removed, for equality checks."""
    toks = []
    i = 0
    n = len(src)
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if c in " \t\f\r\n":
            i += 1
        elif c == "/" and nxt == "/":
            i += 2
            while i < n and src[i] != "\n":
                i += 1
        elif c == "/" and nxt == "*":
            i += 2
            while i < n - 1 and not (src[i] == "*" and src[i + 1] == "/"):
                i += 1
            i = min(i + 2, n)
        elif c == '"':
            i = scan_text_block(src, i) if is_text_block(src, i) else scan_string(src, i)
            toks.append("S")
        elif c == "'":
            i = scan_char(src, i)
            toks.append("C")
        elif c.isalnum() or c in "_$":
            j = i
            while j < n and (src[j].isalnum() or src[j] in "_$"):
                j += 1
            toks.append(src[i:j])
            i = j
        else:
            toks.append(c)
            i += 1
    return toks


def process(path):
    raw = path.read_bytes()
    bom = raw.startswith(b"\xef\xbb\xbf")
    src = raw[3:].decode("utf-8") if bom else raw.decode("utf-8")
    stripped, removed = strip_java(src)
    if removed == 0:
        return (path, 0, False, "unchanged")
    if tokens(src) != tokens(stripped):
        raise ValueError(f"{path}: token stream changed, refusing to write")
    data = stripped.encode("utf-8")
    path.write_bytes((b"\xef\xbb\xbf" if bom else b"") + data)
    return (path, removed, True, "stripped")


def main():
    if len(sys.argv) < 2:
        print("usage: strip_comments.py <dir-or-file>...", file=sys.stderr)
        return 2
    files = []
    for arg in sys.argv[1:]:
        p = Path(arg)
        if p.is_dir():
            files.extend(sorted(p.rglob("*.java")))
        else:
            files.append(p)
    total = 0
    touched = 0
    failures = 0
    for f in files:
        try:
            _, removed, changed, status = process(f)
            total += removed
            touched += 1 if changed else 0
            if changed:
                print(f"{f}: {removed} comment(s) removed")
        except ValueError as exc:
            failures += 1
            print(f"FAIL {exc}", file=sys.stderr)
    print(f"files={len(files)} touched={touched} comments_removed={total} failures={failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
