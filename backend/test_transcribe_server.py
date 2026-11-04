import io
import json
import math
import os
import struct
import tempfile
import unittest
import wave

import transcribe_server
import worker_protocol


def run_worker(lines, handle=lambda request: {"text": f"text of {request['path']}"}):
    out = io.StringIO()
    worker_protocol.serve(handle, {"device": "cuda"}, lines, out)
    return [json.loads(line) for line in out.getvalue().splitlines()]


class ProtocolTests(unittest.TestCase):
    def test_says_ready_first_then_answers_each_request_by_id(self):
        messages = run_worker(['{"id": "a", "path": "one.webm"}\n', '{"id": "b", "path": "two.webm"}\n'])
        self.assertEqual(messages[0], {"ready": True, "device": "cuda"})
        self.assertEqual(messages[1:], [{"id": "a", "text": "text of one.webm"}, {"id": "b", "text": "text of two.webm"}])

    def test_a_failed_request_reports_an_error_and_the_worker_keeps_going(self):
        def handle(request):
            if request["path"] == "bad.webm":
                raise ValueError("could not decode")
            return {"text": "ok"}

        messages = run_worker(['{"id": "a", "path": "bad.webm"}\n', '{"id": "b", "path": "good.webm"}\n'], handle)
        self.assertEqual(messages[1], {"id": "a", "error": "could not decode"})
        self.assertEqual(messages[2], {"id": "b", "text": "ok"})

    def test_broken_lines_get_an_error_without_an_id_and_blank_lines_are_skipped(self):
        messages = run_worker(["not json\n", "\n", '{"path": "x"}\n'])
        self.assertEqual(len(messages), 3)
        self.assertIsNone(messages[1]["id"])
        self.assertIsNone(messages[2]["id"])
        self.assertIn("error", messages[2])

    def test_reads_a_line_that_starts_with_a_byte_order_mark(self):
        messages = run_worker(['﻿{"id": "a", "path": "one.webm"}\n'])
        self.assertEqual(messages[1], {"id": "a", "text": "text of one.webm"})


class DecodeTests(unittest.TestCase):
    def test_turns_any_recording_into_16_khz_mono_samples(self):
        # One second of a stereo 8 kHz tone, so both the channels and the rate must change.
        path = os.path.join(tempfile.mkdtemp(), "tone.wav")
        with wave.open(path, "wb") as out:
            out.setnchannels(2)
            out.setsampwidth(2)
            out.setframerate(8_000)
            tone = (int(16_000 * math.sin(2 * math.pi * 440 * i / 8_000)) for i in range(8_000))
            out.writeframes(b"".join(struct.pack("<hh", s, s) for s in tone))
        samples = transcribe_server.decode(path)
        os.remove(path)
        self.assertEqual(samples.dtype.name, "float32")
        self.assertAlmostEqual(len(samples), 16_000, delta=200)
        self.assertLessEqual(float(abs(samples).max()), 1.0)
        self.assertGreater(float(abs(samples).max()), 0.3)


if __name__ == "__main__":
    unittest.main()


class VoiceTests(unittest.TestCase):
    @staticmethod
    def speech(*parts):
        """A recording: positive numbers are seconds of sound, negative numbers seconds of silence."""
        import numpy as np

        chunks = []
        for seconds in parts:
            n = int(abs(seconds) * 16_000)
            chunks.append(0.3 * np.sin(2 * np.pi * 220 * np.arange(n) / 16_000) if seconds > 0 else np.zeros(n))
        return np.concatenate(chunks).astype(np.float32)

    def test_measures_the_time_spoken_and_the_share_of_pauses(self):
        heard = transcribe_server.voice(self.speech(-0.5, 1, -1, 1, -0.5))
        self.assertAlmostEqual(heard["seconds"], 3, delta=0.05)
        self.assertAlmostEqual(heard["pauses"], 1 / 3, delta=0.02)

    def test_short_gaps_between_words_are_not_pauses(self):
        self.assertEqual(transcribe_server.voice(self.speech(1, -0.1, 1))["pauses"], 0)

    def test_a_quiet_microphone_is_measured_the_same(self):
        loud = transcribe_server.voice(self.speech(1, -1, 1))
        quiet = transcribe_server.voice(self.speech(1, -1, 1) * 0.05)
        self.assertEqual(loud, quiet)

    def test_skips_silence_and_less_than_a_second(self):
        import numpy as np

        self.assertIsNone(transcribe_server.voice(self.speech(-2)))
        self.assertIsNone(transcribe_server.voice(self.speech(-1, 0.5, -1)))
        self.assertIsNone(transcribe_server.voice(np.zeros(0, dtype=np.float32)))

    def test_measures_only_when_asked_and_a_failure_never_loses_the_words(self):
        from unittest import mock

        class Model:
            def transcribe(self, *_args, **_kwargs):
                return [type("Segment", (), {"text": " Hello there "})()], None

        recording = self.speech(1, -1, 1)
        with mock.patch.object(transcribe_server, "decode", return_value=recording):
            self.assertEqual(set(transcribe_server.handle(Model(), {"path": "x.webm", "voice": True})), {"text", "voice"})
            self.assertEqual(transcribe_server.handle(Model(), {"path": "x.webm"}), {"text": "Hello there"})
            with mock.patch.object(transcribe_server, "voice", side_effect=RuntimeError("bad audio")):
                self.assertEqual(transcribe_server.handle(Model(), {"path": "x.webm", "voice": True}), {"text": "Hello there"})
