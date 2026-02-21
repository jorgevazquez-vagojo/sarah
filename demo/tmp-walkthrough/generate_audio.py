import asyncio
import json
import os

import edge_tts

VOICE = "es-ES-AlvaroNeural"
DIR = os.path.dirname(os.path.abspath(__file__))

async def gen_all():
    with open(os.path.join(DIR, "narrations.json"), "r") as f:
        narrations = json.load(f)

    for item in narrations:
        num = item["num"]
        text = item["text"]
        outfile = os.path.join(DIR, f"audio-{num}.mp3")
        if os.path.exists(outfile) and os.path.getsize(outfile) > 1000:
            print(f"audio-{num}.mp3 already exists, skipping")
            continue
        print(f"Generating audio-{num}.mp3 ...")
        c = edge_tts.Communicate(text, VOICE)
        await c.save(outfile)
        print(f"  done ({os.path.getsize(outfile)} bytes)")

asyncio.run(gen_all())
print("All audio files generated.")
