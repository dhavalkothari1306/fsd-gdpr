#!/usr/bin/env python3
"""Command-line bridge between the Node/Express API and the Python engine.

Protocol: every command prints exactly ONE JSON document on stdout. The
analyzer's own console output (banners, [DEBUG] lines, ...) is redirected to
stderr so it can never corrupt that JSON.

    python -m analyzer.cli validate <url>
        -> {"ok": true, "target": "<normalized url>"}

    python -m analyzer.cli scan <url>
        -> {"ok": true, "result": {...}}

    python -m analyzer.cli report <label> <output.pdf>   (result JSON on stdin)
        -> {"ok": true, "path": "<output.pdf>"}

On failure: {"ok": false, "kind": "validation"|"scan"|"report", "error": "..."}
Exit codes: 0 ok, 2 validation error, 1 any other failure.
"""

import contextlib
import json
import sys


def _emit(payload: dict, code: int = 0) -> None:
    # sys.__stdout__ is the real stdout even while sys.stdout is redirected.
    sys.__stdout__.write(json.dumps(payload, default=str))
    sys.__stdout__.write("\n")
    sys.__stdout__.flush()
    sys.exit(code)


def main(argv) -> None:
    if len(argv) < 2:
        _emit({"ok": False, "kind": "usage", "error": __doc__}, 1)

    command, args = argv[1], argv[2:]

    # Keep stdout clean: analyzer prints go to stderr.
    with contextlib.redirect_stdout(sys.stderr):
        try:
            if command in ("validate", "scan") and len(args) == 1:
                from analyzer.target import normalize_target

                try:
                    target = normalize_target(args[0])
                except ValueError as exc:
                    _emit({"ok": False, "kind": "validation", "error": str(exc)}, 2)

                if command == "validate":
                    payload = {"ok": True, "target": target}
                else:
                    from analyzer.scanner import run_scan

                    payload = {"ok": True, "result": run_scan(target)}

            elif command == "report" and len(args) == 2:
                from modules.report.generate_report import generate_report

                generate_report(args[0], sys.stdin.read(), args[1])
                payload = {"ok": True, "path": args[1]}

            else:
                payload = {"ok": False, "kind": "usage", "error": __doc__}

        except Exception as exc:  # noqa: BLE001 - surfaced to the API caller
            import traceback

            traceback.print_exc(file=sys.stderr)
            _emit({"ok": False, "kind": command, "error": f"{type(exc).__name__}: {exc}"}, 1)

    _emit(payload, 0 if payload.get("ok") else 1)


if __name__ == "__main__":
    main(sys.argv)
