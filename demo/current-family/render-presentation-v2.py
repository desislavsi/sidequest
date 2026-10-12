"""Render the SideQuest demo with connected local narration and a quiet original music bed."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig


HERE = Path(__file__).resolve().parent
CHAPTERS_PATH = HERE / "narration-presentation-v2.json"
RATE = 22050


def synthesize_chapters(chapters: list[dict], voice_path: Path, work: Path, speaker_id: int) -> list[tuple[Path, float]]:
    work.mkdir(parents=True, exist_ok=True)
    voice = PiperVoice.load(str(voice_path))
    voice_config = SynthesisConfig(speaker_id=speaker_id)
    results: list[tuple[Path, float]] = []
    for index, chapter in enumerate(chapters, start=1):
        audio_path = work / f"chapter-{index:02d}.wav"
        with wave.open(str(audio_path), "wb") as audio_file:
            voice.synthesize_wav(chapter["text"], audio_file, syn_config=voice_config)
        with wave.open(str(audio_path), "rb") as audio_file:
            duration = audio_file.getnframes() / audio_file.getframerate()
        results.append((audio_path, duration))
        target = chapter["end"] - chapter["start"]
        print(f"{index:02d} {chapter['start']:>3}-{chapter['end']:>3}s | {duration:5.2f}s / {target:2d}s | {len(chapter['text'].split()):2d} words", flush=True)
    return results


def make_music(duration: float, work: Path) -> Path:
    """Make a restrained instrumental pad and plucked notes; no sampled music."""
    music_path = work / "original-music.wav"
    length = math.ceil(duration * RATE)
    left = np.zeros(length, dtype=np.float32)
    right = np.zeros(length, dtype=np.float32)
    chords = (
        (261.63, 329.63, 392.00, 493.88),  # C major seventh
        (220.00, 261.63, 329.63, 392.00),  # A minor seventh
        (174.61, 220.00, 261.63, 329.63),  # F major seventh
        (196.00, 246.94, 293.66, 349.23),  # G seventh
    )
    block_seconds = 14.0
    for block, start in enumerate(np.arange(0, duration, block_seconds)):
        chord = chords[block % len(chords)]
        count = min(length - int(start * RATE), int((block_seconds + 1.8) * RATE))
        if count <= 0:
            continue
        t = np.arange(count, dtype=np.float32) / RATE
        attack = np.minimum(1.0, t / 1.3)
        release = np.minimum(1.0, np.maximum(0.0, block_seconds + 1.8 - t) / 1.8)
        envelope = attack * release
        pad = np.zeros(count, dtype=np.float32)
        for note in chord:
            pad += (np.sin(2 * np.pi * note * t) + 0.14 * np.sin(2 * np.pi * 2 * note * t)) / len(chord)
        offset = int(start * RATE)
        left[offset : offset + count] += pad * envelope * 0.045
        right[offset : offset + count] += pad * envelope * 0.043

    for beat, start in enumerate(np.arange(1.0, duration - 1.0, 2.5)):
        chord = chords[int(start // block_seconds) % len(chords)]
        note = chord[(beat * 3) % len(chord)] * (2 if beat % 4 == 3 else 1)
        count = min(length - int(start * RATE), int(2.0 * RATE))
        t = np.arange(count, dtype=np.float32) / RATE
        pluck = (np.sin(2 * np.pi * note * t) + 0.22 * np.sin(2 * np.pi * 2 * note * t)) * np.exp(-t * 2.3)
        offset = int(start * RATE)
        if beat % 2:
            left[offset : offset + count] += pluck * 0.018
            right[offset : offset + count] += pluck * 0.028
        else:
            left[offset : offset + count] += pluck * 0.028
            right[offset : offset + count] += pluck * 0.018

    fade = min(length // 2, RATE * 3)
    ramp = np.linspace(0, 1, fade, dtype=np.float32)
    left[:fade] *= ramp
    right[:fade] *= ramp
    left[-fade:] *= ramp[::-1]
    right[-fade:] *= ramp[::-1]
    stereo = np.column_stack((left, right))
    peak = float(np.max(np.abs(stereo)))
    if peak > 0.8:
        stereo *= 0.8 / peak
    with wave.open(str(music_path), "wb") as audio_file:
        audio_file.setnchannels(2)
        audio_file.setsampwidth(2)
        audio_file.setframerate(RATE)
        audio_file.writeframes((stereo * 32767).astype("<i2").tobytes())
    return music_path


def render(chapters: list[dict], audio: list[tuple[Path, float]], duration: float, ffmpeg: Path, output: Path, work: Path) -> None:
    music_path = make_music(duration, work)
    inputs = ["-i", str(HERE / "sidequest-demo-current-family.mp4")]
    for audio_path, _ in audio:
        inputs += ["-i", str(audio_path)]
    inputs += ["-i", str(music_path)]
    filters: list[str] = []
    labels: list[str] = []
    for index, chapter in enumerate(chapters, start=1):
        delay = round(chapter["start"] * 1000)
        filters.append(f"[{index}:a]aresample=48000,adelay={delay}:all=1,volume=0.92[voice{index}]")
        labels.append(f"[voice{index}]")
    music_input = len(chapters) + 1
    filters.append(f"[{music_input}:a]aresample=48000,volume=0.9[music]")
    labels.append("[music]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:duration=longest:dropout_transition=0:normalize=0,atrim=duration={duration},loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
    command = [
        str(ffmpeg), "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filters),
        "-map", "0:v:0", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-ar", "48000", "-ac", "2", "-movflags", "+faststart", "-t", str(duration), str(output),
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(command, check=True)
    print(f"Saved {output}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice-path", type=Path, required=True, help="Path to a local Piper .onnx voice")
    parser.add_argument("--speaker-id", type=int, default=16, help="Piper speaker id for a multi-speaker voice")
    parser.add_argument("--ffmpeg", type=Path, default=Path(shutil.which("ffmpeg") or ""), help="FFmpeg executable; defaults to PATH")
    parser.add_argument("--output", type=Path, default=HERE / "sidequest-demo-presentation.mp4")
    parser.add_argument("--render", action="store_true", help="Render the video after measuring chapter speech")
    args = parser.parse_args()
    if not args.voice_path.is_file():
        raise SystemExit(f"Piper voice file not found: {args.voice_path}")
    if not args.ffmpeg.is_file():
        raise SystemExit("FFmpeg was not found. Pass its executable path with --ffmpeg.")
    document = json.loads(CHAPTERS_PATH.read_text(encoding="utf-8"))
    chapters = document["chapters"]
    with tempfile.TemporaryDirectory(prefix="sidequest-presentation-") as temporary:
        work = Path(temporary)
        audio = synthesize_chapters(chapters, args.voice_path, work, args.speaker_id)
        overflow = [(index, length, chapter["end"] - chapter["start"]) for index, (chapter, (_, length)) in enumerate(zip(chapters, audio), start=1) if length > chapter["end"] - chapter["start"] - 0.15]
        if overflow:
            raise SystemExit(f"Chapter narration does not fit: {overflow}")
        if args.render:
            render(chapters, audio, float(document["durationSeconds"]), args.ffmpeg, args.output, work)


if __name__ == "__main__":
    main()
