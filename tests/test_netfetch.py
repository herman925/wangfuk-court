import io
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

from tools.netfetch import fetch_bytes, require_pdf

URL = 'https://example.invalid/status.pdf'


class FetchRetryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.sleeps: list[float] = []
        self.logs: list[str] = []
        self.calls = 0

    def fetch(self, outcomes: list, **kwargs) -> bytes:
        pending = list(outcomes)

        def fake_urlopen(request, timeout):
            self.calls += 1
            outcome = pending.pop(0)
            if isinstance(outcome, BaseException):
                raise outcome
            return io.BytesIO(outcome)

        with patch('tools.netfetch.urllib.request.urlopen', side_effect=fake_urlopen):
            return fetch_bytes(urllib.request.Request(URL), sleep=self.sleeps.append, log=self.logs.append, **kwargs)

    def test_transient_handshake_timeout_is_retried(self) -> None:
        body = self.fetch([urllib.error.URLError(TimeoutError('handshake')), b'%PDF-1.7'])
        self.assertEqual(body, b'%PDF-1.7')
        self.assertEqual((self.calls, self.sleeps), (2, [10]))
        self.assertIn(URL, self.logs[0])

    def test_gives_up_after_bounded_attempts(self) -> None:
        with self.assertRaises(urllib.error.URLError):
            self.fetch([urllib.error.URLError(TimeoutError('handshake'))] * 4)
        self.assertEqual((self.calls, self.sleeps), (4, [10, 30, 60]))

    def test_server_overload_is_retried(self) -> None:
        body = self.fetch([urllib.error.HTTPError(URL, 503, 'Unavailable', {}, None), b'%PDF-1.7'])
        self.assertEqual(body, b'%PDF-1.7')
        self.assertEqual((self.calls, self.sleeps), (2, [10]))

    def test_client_error_fails_immediately(self) -> None:
        with self.assertRaises(urllib.error.HTTPError):
            self.fetch([urllib.error.HTTPError(URL, 404, 'Not Found', {}, None)])
        self.assertEqual((self.calls, self.sleeps), (1, []))

    def test_maintenance_page_with_success_status_is_retried(self) -> None:
        body = self.fetch([b'<html>maintenance</html>', b'%PDF-1.7'], validate=lambda raw: require_pdf(raw, URL))
        self.assertEqual(body, b'%PDF-1.7')
        self.assertEqual(self.calls, 2)

    def test_invalid_content_fails_after_all_attempts(self) -> None:
        with self.assertRaises(ValueError):
            self.fetch([b'<html>maintenance</html>'] * 4, validate=lambda raw: require_pdf(raw, URL))
        self.assertEqual(self.calls, 4)


class RequirePdfTests(unittest.TestCase):
    def test_only_pdf_bytes_pass(self) -> None:
        require_pdf(b'%PDF-1.7', URL)
        with self.assertRaises(ValueError):
            require_pdf(b'<html>', URL)


if __name__ == '__main__':
    unittest.main()
