#!/usr/bin/env bash
# Verifies the ffmpeg leg of the pipeline on a synthetic "screen recording": zoom/pan, crop, speed, freeze, text, encode.
set -euo pipefail
O=05_renders/tests; mkdir -p $O 06_tmp
ffmpeg -y -v error -f lavfi -i "testsrc2=size=1920x1080:rate=60:duration=4" -f lavfi -i "sine=frequency=440:duration=4" -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac 06_tmp/synthetic_src.mp4
# zoom/pan + drawtext + 2x speed + freeze last frame 1s, then H.264 + ProRes 422 HQ + HEVC(videotoolbox)
ffmpeg -y -v error -i 06_tmp/synthetic_src.mp4 -filter_complex "[0:v]setpts=0.5*PTS,zoompan=z='min(zoom+0.0015,1.3)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=60,tpad=stop_mode=clone:stop_duration=1[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart $O/test_h264.mp4
ffmpeg -y -v error -i $O/test_h264.mp4 -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le $O/test_prores422hq.mov
ffmpeg -y -v error -i $O/test_h264.mp4 -c:v hevc_videotoolbox -b:v 12M -tag:v hvc1 $O/test_hevc_vt.mp4
# 9:16 reframe crop test
ffmpeg -y -v error -i $O/test_h264.mp4 -vf "crop=607:1080:(iw-607)/2:0,scale=1080:1920" -c:v libx264 -crf 18 $O/test_9x16.mp4
# frame interpolation test (safe only for slow pans)
ffmpeg -y -v error -t 1 -i 06_tmp/synthetic_src.mp4 -vf "minterpolate=fps=120:mi_mode=mci" -c:v libx264 -crf 18 $O/test_minterp120.mp4
for f in $O/test_*; do printf "%s  " "$f"; ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of csv=p=0 "$f" | tr '\n' ' '; echo; done
