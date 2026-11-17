"""Fetch public sources with bounded retries so one transient failure does not drop a whole refresh."""

import time
import urllib.error
import urllib.request
from collections.abc import Callable
from http.client import HTTPException

# Timeouts, rate limits and server-side failures are worth another attempt; other client errors are not.
RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})


def require_pdf(raw: bytes, url: str) -> None:
    if not raw.startswith(b'%PDF'):
        raise ValueError(f'Not a PDF: {url}')


def fetch_bytes(request: urllib.request.Request, *, validate: Callable[[bytes], object] | None = None,
                attempts: int = 4, timeout: float = 60, backoff: tuple[float, ...] = (10, 30, 60),
                sleep: Callable[[float], None] = time.sleep, log: Callable[[str], None] = print) -> bytes:
    """Return the response body, retrying dropped connections, timeouts, retryable statuses and bodies that fail validate.

    Each failed attempt is logged as a GitHub warning annotation; the final failure is re-raised unchanged.
    """
    url = request.full_url
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read()
        except urllib.error.HTTPError as error:
            error.close()  # release the connection; the status code and headers remain readable
            if error.code not in RETRYABLE_STATUS:
                raise
            failure = error
        except (OSError, HTTPException) as error:  # DNS, TLS handshake, timeouts and dropped connections
            failure = error
        else:
            try:
                if validate:
                    validate(raw)
                return raw
            except ValueError as error:  # e.g. a maintenance page served with HTTP 200
                failure = error
        if attempt < attempts:
            delay = backoff[min(attempt - 1, len(backoff) - 1)]
            log(f'::warning::Attempt {attempt}/{attempts} for {url} failed ({failure}); retrying in {delay}s')
            sleep(delay)
    log(f'::error::{url} failed after {attempts} attempts')
    raise failure
