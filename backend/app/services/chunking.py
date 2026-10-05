def _split_long(text: str, size: int, overlap: int) -> list[str]:
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            space = text.rfind(" ", start, end)
            if space > start + size // 2:
                end = space
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return [c for c in chunks if c]


def chunk_text(text: str, size: int = 600, overlap: int = 80, min_size: int = 120) -> list[str]:
    paragraphs = [" ".join(p.split()) for p in text.replace("\r\n", "\n").split("\n\n")]
    paragraphs = [p for p in paragraphs if p]

    chunks, current = [], ""
    for p in paragraphs:
        # only merge a paragraph into the previous one if the previous is tiny
        if current and len(current) < min_size and len(current) + len(p) + 1 <= size:
            current = f"{current} {p}"
            continue
        if current:
            chunks.append(current)
        current = p
    if current:
        chunks.append(current)

    final = []
    for c in chunks:
        final.extend(_split_long(c, size, overlap) if len(c) > size else [c])
    return final