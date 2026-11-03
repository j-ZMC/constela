import os
import tempfile
import unittest
import wave

import numpy as np

import speak_server


class FakeKokoro:
    def __init__(self):
        self.calls = []

    def create(self, text, voice, speed, lang):
        self.calls.append((text, voice, speed, lang))
        # Half a second, a little too loud on purpose: the WAV must clip it, not wrap around.
        return np.full(12_000, 1.5, dtype=np.float32), 24_000


class SpeakTests(unittest.TestCase):
    def setUp(self):
        self.path = os.path.join(tempfile.mkdtemp(), "speech.wav")

    def tearDown(self):
        if os.path.exists(self.path):
            os.remove(self.path)

    def test_writes_a_16_bit_mono_wav_with_the_chosen_voice(self):
        model = FakeKokoro()
        result = speak_server.speak(model, "Tell me about yourself.", self.path)
        self.assertEqual(result, {"seconds": 0.5})
        self.assertEqual(model.calls, [("Tell me about yourself.", speak_server.VOICE, speak_server.SPEED, "en-us")])
        with wave.open(self.path) as audio:
            self.assertEqual((audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getnframes()), (1, 2, 24_000, 12_000))
            first = int.from_bytes(audio.readframes(1), "little", signed=True)
        self.assertEqual(first, 32767)

    def test_refuses_empty_text(self):
        with self.assertRaises(ValueError):
            speak_server.speak(FakeKokoro(), "   ", self.path)


if __name__ == "__main__":
    unittest.main()
