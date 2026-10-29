Moon Push BGM — CHIP DAW 8bit originals
=======================================
Royalty-free chip originals made for pianopia/x-bm-demos (Moon Push, ps1-moon-push-2026-10-29). Free to use, modify, and loop in that project.

Files are seamless one-cycle loops (renderSongBuffer(song,{seamless:true,loops:1})): the echo/release tail is folded onto the head, so loop the whole file with no gap or crossfade (e.g. AudioBufferSourceNode.loop = true, or <audio loop>). Prefer the WAV (or decode the MP3 to an AudioBuffer) for gapless looping; MP3 encoders add a little padding at the start and end.

moon-push-lobby  — "Moon Push — Lobby"
  BPM 88, F lydian, echo 0.32, 8 patterns x 32 rows, loop = 43.636 s
  moon-push-lobby.wav (44.1kHz mono 16-bit) / .mp3 (160kbps) / .chip.json (open in CHIP DAW)

moon-push-match  — "Moon Push — Match"
  BPM 128, C major, echo 0.14, 9 patterns x 32 rows, loop = 33.750 s
  moon-push-match.wav (44.1kHz mono 16-bit) / .mp3 (160kbps) / .chip.json (open in CHIP DAW)

moon-push-songs.js — songFromText source (exports MOON_LOBBY, MOON_MATCH, MOON_PUSH_SONGS). It imports './chip.js', so drop it into x-bm-demos/audio/ next to chip.js.
