#!/usr/bin/env bash
# Forensic ingest of a raw screen recording. Non-destructive: reads 00_raw/, writes 01_analysis/ + 02_audio/.
# usage: scripts/ingest.sh 00_raw/<recording>
set -euo pipefail
SRC="$1"; B=$(basename "${SRC%.*}"); A=01_analysis; mkdir -p $A/frames $A/proxies $A/contact_sheets 02_audio
shasum -a 256 "$SRC" > "$A/$B.sha256"
ffprobe -v error -show_format -show_streams -of json "$SRC" > "$A/$B.probe.json"
ffprobe -v error -select_streams v:0 -show_entries frame=pts_time -of csv=p=0 "$SRC" | head -2000 > "$A/$B.pts_head.csv"   # frame pacing check
# 480p proxy for fast scrubbing
ffmpeg -y -v error -i "$SRC" -vf "scale=-2:480" -c:v libx264 -preset veryfast -crf 24 -an "$A/proxies/$B.proxy480.mp4"
# frame index: 1 frame / 2s
ffmpeg -y -v error -i "$SRC" -vf "fps=1/2,scale=-2:240" "$A/frames/${B}_%05d.jpg"
# contact sheets: 1 frame / 5s, 6x8 tiles (tile k on sheet n => t = (n*48+k)*5 s). No drawtext in this ffmpeg build; text is rendered in HyperFrames.
ffmpeg -y -v error -i "$SRC" -vf "fps=1/5,scale=320:-2,tile=6x8" "$A/contact_sheets/${B}_sheet_%03d.png"
# scene-change + frame-difference analysis
ffmpeg -v info -i "$SRC" -vf "scdet=threshold=8,metadata=print:file=$A/$B.scdet.txt" -f null - 2>/dev/null || true
ffmpeg -v info -i "$SRC" -vf "select='gt(scene,0.15)',metadata=print:file=$A/$B.scenes.txt" -an -f null - 2>/dev/null || true
# audio
if ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$SRC" | grep -q audio; then
  ffmpeg -y -v error -i "$SRC" -vn -ac 2 -ar 48000 "02_audio/$B.wav"
  ffmpeg -i "$SRC" -af "volumedetect" -f null - 2>&1 | grep -E "mean_volume|max_volume" > "$A/$B.audio_levels.txt" || true
  ffmpeg -i "$SRC" -af "silencedetect=noise=-40dB:d=2" -f null - 2>&1 | grep silence_ > "$A/$B.silence.txt" || true
else echo "NO AUDIO STREAM" > "$A/$B.audio_levels.txt"; fi
echo "ingest done -> $A"
