# Current-family demo assets

This folder contains the anonymized family recording, selected screenshots, the final narrated export, and its chapter script.

- [Video demo on YouTube](https://youtu.be/_0JU-WzOz3w)
- `sidequest-demo-current-family.mp4` is the original silent screen recording.
- `sidequest-demo-presentation.mp4` is the narrated presentation export.
- `narration-presentation-v2.json` contains the eight narration chapters.
- `render-presentation-v2.py` synthesizes the chapters with a local Piper voice, creates an original quiet instrumental bed, and muxes the audio onto the recording while copying its video stream.

To render the export, use Python with `piper-tts` and `numpy`, plus a Piper `.onnx` voice and FFmpeg:

```powershell
python demo/current-family/render-presentation-v2.py `
  --voice-path C:\path\to\en_US-arctic-medium.onnx `
  --speaker-id 16 `
  --ffmpeg C:\path\to\ffmpeg.exe `
  --output demo/current-family/sidequest-demo-presentation.mp4 `
  --render
```

Omit `--render` to synthesize the narration and inspect measured chapter durations without creating the MP4.
