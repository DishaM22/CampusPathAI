"""
check_models.py - try a few Gemini models with YOUR key and show which work.

Run from the backend folder (virtual environment active):

    python check_models.py
    python check_models.py gemini-2.5-flash-lite gemini-3.1-flash-lite

Prints OK / FAILED for each model, how long it took, and a short error.
Nothing is changed; it only sends the words "Say hello in five words".
"""

import os
import sys
import time

from dotenv import load_dotenv
from google import genai

DEFAULT_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
]


def main() -> None:
    load_dotenv()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is missing from backend/.env")
        return

    client = genai.Client(api_key=api_key, http_options={"timeout": 20000})
    models = sys.argv[1:] or DEFAULT_MODELS

    for model in models:
        model = model.replace("models/", "")
        started = time.time()
        try:
            response = client.models.generate_content(
                model=model, contents="Say hello in five words"
            )
            text = (response.text or "").strip().replace("\n", " ")
            print(f"OK      {model:<28} {time.time() - started:4.1f}s  {text[:60]}")
        except Exception as exc:  # show the reason, keep going
            reason = str(exc).replace("\n", " ")[:90]
            print(f"FAILED  {model:<28} {time.time() - started:4.1f}s  "
                  f"{type(exc).__name__}: {reason}")


if __name__ == "__main__":
    main()