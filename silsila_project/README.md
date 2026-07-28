# Silsila — A Living Map of Family Memories

Silsila is a polished, dependency-free browser prototype that turns family stories into an interactive constellation of people, places, dates, and memories.

## Run it

Open `index.html` in a modern browser. No installation or server is required.

For microphone access, some browsers require a local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## What already works

- Add a family memory with title, storyteller, language, year, original story, and translation.
- Optional browser-based audio recording.
- Local entity extraction for people, places, years, and themes.
- Interactive memory constellation with connected nodes.
- Timeline and migration/place views.
- Search across stories with grounded results.
- Detail panel that always points back to the original story.
- Local browser persistence using `localStorage`.
- Responsive desktop/mobile layout.

## Important prototype limitation

This prototype intentionally avoids pretending it has production AI. Entity extraction and archive search run locally using simple rules. A production version would add real multilingual transcription, translation, embeddings, and graph storage while keeping original recordings as the source of truth.

## Strong next technical milestones

1. **Multilingual transcription:** Whisper or another speech model with Urdu/Punjabi code-switching support.
2. **Translation with provenance:** Store original text, translated text, model version, and confidence separately.
3. **Graph database:** Neo4j or PostgreSQL + pgvector for people/place/event relationships.
4. **Semantic search:** Retrieval across transcript chunks with citations to exact audio timestamps.
5. **Collaborative corrections:** Family review flow before uncertain facts become canonical.
6. **Privacy:** End-to-end encryption, family-level permissions, export, and deletion controls.
7. **Photo linking:** Match uploaded photos to people, places, and time periods with user confirmation.

## Suggested demo flow

1. Open the guided tour.
2. Click **Add memory** and then **Load sample story**.
3. Create the memory thread.
4. Click its nodes in the constellation.
5. Switch to **Timeline** and **Places**.
6. Ask: `What stories mention moving to Canada?`
7. Explain the key design principle: AI organizes memories but never replaces the original voice.

## Application story angle

The project began with a fear that family history can disappear even when everyone is still alive, because it lives in scattered conversations and languages younger relatives may understand less fluently. The hardest design problem is not generating text; it is handling uncertainty without rewriting history. Every extracted fact therefore remains connected to the original memory, confidence is visible, and corrections are treated as family collaboration rather than silent AI edits.
