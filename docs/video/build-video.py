"""Assembles the demo video from the screen recordings, the two cards, the edge-tts
voice-over and its subtitles.   python docs/video/build-video.py
Output: docs/video/overturn-demo.mp4 (1920x1080, 30 fps, H.264 + AAC, burned-in subtitles).

Raw takes are 1280x720 captures of a wide browser window; the site column is centred,
so each take is cropped around it and upscaled.
"""
import pathlib, re, shutil, subprocess, sys

HERE = pathlib.Path(__file__).parent
FFMPEG = r"C:\Users\Anas\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"
RAW = HERE / "raw"
VO = HERE / "vo"
WORK = HERE / "work" / "seg"
OUT = HERE / "overturn-demo.mp4"

TAKE = {
    1: RAW / "2026-09-19 23-25-52.mp4",  # home -> sample -> understand
    2: RAW / "2026-09-19 23-27-15.mp4",  # understand
    3: RAW / "2026-09-19 23-28-42.mp4",  # rights
    4: RAW / "2026-09-19 23-33-45.mp4",  # letter
    5: RAW / "2026-09-19 23-38-17.mp4",  # home again + README
}
# Two crops: the home page is 1040px wide, the flow is a 680px column.
WIDE = "crop=1066:600:107:30,scale=1920:1080:flags=lanczos"
COLUMN = "crop=853:480:214:40,scale=1920:1080:flags=lanczos"
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-an"]

# One voice-over file per block; the video pieces under it add up to the block's duration.
# (take, start_in_take, duration, crop) — or ("card", png, duration, None)
BLOCKS = [
    ("00", [("card", "card-title.png", 18.5, None)]),
    ("01", [(1, 4.0, 8.0, WIDE), (1, 13.5, 6.0, WIDE), (1, 20.5, 4.0, COLUMN)]),
    ("02", [(2, 0.0, 4.0, COLUMN), (2, 4.5, 4.5, COLUMN), (2, 10.0, 7.0, COLUMN), (2, 25.0, 7.6, COLUMN)]),
    ("03", [(3, 1.5, 5.0, COLUMN), (3, 12.0, 3.0, COLUMN), (3, 24.0, 5.0, COLUMN), (3, 33.0, 4.0, COLUMN), (3, 40.0, 9.8, COLUMN)]),
    ("04", [(4, 2.0, 4.0, COLUMN), (4, 31.0, 5.0, COLUMN), (4, 56.0, 6.0, COLUMN), (4, 66.0, 4.0, COLUMN), (4, 80.0, 4.1, COLUMN)]),
    ("05", [(5, 23.5, 6.0, WIDE), (5, 34.0, 15.6, WIDE)]),
    ("06", [("card", "card-end.png", 10.0, None)]),
]
VO_LEAD = 0.4  # seconds of silence before each block's first word


def run(args):
    subprocess.run([FFMPEG, "-v", "error", "-y", *args], check=True)


def duration(path):
    out = subprocess.run([FFMPEG.replace("ffmpeg.exe", "ffprobe.exe"), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def to_s(t):
    h, m, rest = t.split(":"); s, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def fmt(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main():
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)

    video_parts, audio_parts, cues = [], [], []
    t = 0.0
    n = 0
    for vo_id, pieces in BLOCKS:
        block_len = sum(p[2] for p in pieces)
        vo_len = duration(VO / f"{vo_id}.mp3")
        if vo_len + VO_LEAD > block_len:
            print(f"block {vo_id}: voice {vo_len:.1f}s does not fit in {block_len:.1f}s of video")
        # video pieces
        for take, start, dur, crop in pieces:  # for a card, start is the PNG name
            out = WORK / f"{n:02}.mp4"
            if take == "card":
                run(["-loop", "1", "-framerate", "30", "-t", str(dur), "-i", str(HERE / start), "-vf", "scale=1920:1080,format=yuv420p", *ENC, str(out)])
            else:
                run(["-ss", str(start), "-i", str(TAKE[take]), "-t", str(dur), "-vf", crop, *ENC, str(out)])
            video_parts.append(out)
            n += 1
        # audio: lead silence + voice + tail silence = block length
        a = WORK / f"a{vo_id}.m4a"
        tail = max(0.0, block_len - VO_LEAD - vo_len)
        run(["-i", str(VO / f"{vo_id}.mp3"), "-af", f"adelay={int(VO_LEAD*1000)}|{int(VO_LEAD*1000)},apad=pad_dur={tail:.3f},atrim=0:{block_len:.3f},aresample=48000", "-ac", "2", "-c:a", "aac", "-b:a", "160k", str(a)])
        audio_parts.append(a)
        # subtitles shifted into the timeline
        for m in re.finditer(r"(\d\d:\d\d:\d\d,\d\d\d) --> (\d\d:\d\d:\d\d,\d\d\d)\n(.+?)(?:\n\n|\Z)", (VO / f"{vo_id}.srt").read_text(encoding="utf8"), re.S):
            cues.append((t + VO_LEAD + to_s(m.group(1)), t + VO_LEAD + to_s(m.group(2)), m.group(3).strip()))
        print(f"block {vo_id}: {block_len:5.1f}s (voice {vo_len:4.1f}s)  -> {t + block_len:6.1f}s")
        t += block_len

    (WORK / "v.txt").write_text("".join(f"file '{p.as_posix()}'\n" for p in video_parts), encoding="utf8")
    (WORK / "a.txt").write_text("".join(f"file '{p.as_posix()}'\n" for p in audio_parts), encoding="utf8")
    run(["-f", "concat", "-safe", "0", "-i", str(WORK / "v.txt"), "-c", "copy", str(WORK / "video.mp4")])
    run(["-f", "concat", "-safe", "0", "-i", str(WORK / "a.txt"), "-c", "copy", str(WORK / "audio.m4a")])

    srt = WORK / "subs.srt"
    srt.write_text("".join(f"{i+1}\n{fmt(a)} --> {fmt(b)}\n{txt}\n\n" for i, (a, b, txt) in enumerate(cues)), encoding="utf8")
    srt_path = srt.as_posix().replace(":", "\\:")
    run([
        "-i", str(WORK / "video.mp4"), "-i", str(WORK / "audio.m4a"),
        "-map", "0:v", "-map", "1:a",
        "-vf", f"subtitles='{srt_path}':force_style='FontName=Segoe UI,FontSize=17,PrimaryColour=&H00FFFFFF,BackColour=&H8A000000,BorderStyle=4,Outline=0,Shadow=0,MarginV=28,MarginL=40,MarginR=40'",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest",
        str(OUT),
    ])
    print("->", OUT, f"{t:.1f}s")


if __name__ == "__main__":
    main()
