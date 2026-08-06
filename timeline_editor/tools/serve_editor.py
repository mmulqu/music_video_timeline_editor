"""Serve Timeline Desk with byte-range support for reliable media seeking."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


MEDIA_EXTENSIONS = {
    ".avif": "image",
    ".bmp": "image",
    ".gif": "gif",
    ".jpeg": "image",
    ".jpg": "image",
    ".png": "image",
    ".webp": "image",
    ".m4v": "video",
    ".mkv": "video",
    ".mov": "video",
    ".mp4": "video",
    ".webm": "video",
}


class RangeRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, directory: str, **kwargs):
        self._byte_range: tuple[int, int] | None = None
        self._project_root = Path(directory).resolve()
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self) -> None:
        if urlsplit(self.path).path == "/api/media":
            self._send_media_index()
            return
        super().do_GET()

    def _send_media_index(self) -> None:
        media_root = self._project_root / "images"
        assets: list[dict[str, object]] = []
        if media_root.is_dir():
            for path in media_root.rglob("*"):
                media_type = MEDIA_EXTENSIONS.get(path.suffix.lower())
                if not media_type or not path.is_file() or path.is_symlink():
                    continue
                try:
                    stat = path.stat()
                    relative_path = path.relative_to(self._project_root).as_posix()
                except (FileNotFoundError, ValueError):
                    continue
                stable_id = hashlib.sha1(relative_path.casefold().encode("utf-8")).hexdigest()[:12]
                assets.append(
                    {
                        "id": f"A-scan-{stable_id}",
                        "name": path.name,
                        "relative_path": relative_path,
                        "type": media_type,
                        "modified_ms": stat.st_mtime_ns // 1_000_000,
                        "size_bytes": stat.st_size,
                    }
                )

        assets.sort(key=lambda item: str(item["relative_path"]).casefold())
        body = json.dumps(
            {"root": "images", "scanned_at_ms": int(time.time() * 1000), "assets": assets},
            ensure_ascii=False,
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self) -> None:
        request_path = urlsplit(self.path).path.lower()
        if request_path != "/api/media" and (
            request_path.endswith("/") or Path(request_path).suffix in {".html", ".css", ".js", ".json"}
        ):
            self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        content_type = self.guess_type(path)
        try:
            source = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        stat = os.fstat(source.fileno())
        file_size = stat.st_size
        range_header = self.headers.get("Range")

        if range_header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
            if not match or (not match.group(1) and not match.group(2)):
                source.close()
                self.send_error(416, "Requested Range Not Satisfiable")
                return None

            start_text, end_text = match.groups()
            if start_text:
                start = int(start_text)
                end = int(end_text) if end_text else file_size - 1
            else:
                suffix_length = int(end_text)
                start = max(0, file_size - suffix_length)
                end = file_size - 1

            if start >= file_size or start > end or file_size == 0:
                source.close()
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{file_size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None

            end = min(end, file_size - 1)
            self._byte_range = (start, end)
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            content_length = end - start + 1
        else:
            self._byte_range = None
            self.send_response(200)
            content_length = file_size

        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(content_length))
        self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
        self.end_headers()
        return source

    def copyfile(self, source, outputfile) -> None:
        if self._byte_range is None:
            shutil.copyfileobj(source, outputfile)
            return

        start, end = self._byte_range
        source.seek(start)
        remaining = end - start + 1
        while remaining:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


def main() -> None:
    default_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8878)
    parser.add_argument("--directory", type=Path, default=default_root)
    args = parser.parse_args()

    root = args.directory.resolve()
    handler = lambda *handler_args, **handler_kwargs: RangeRequestHandler(  # noqa: E731
        *handler_args, directory=str(root), **handler_kwargs
    )
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Timeline Desk serving {root} at http://127.0.0.1:{args.port}/timeline_editor/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
