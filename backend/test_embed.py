from app.services.embeddings import embed_text

a = embed_text("Should I quit my job to learn AI full time?")
b = embed_text("Is it wise to leave employment and study machine learning?")
c = embed_text("What is a good recipe for chicken biryani?")

def cos(x, y):
    return sum(i * j for i, j in zip(x, y))

print("dimension:", len(a))
print("job vs job-paraphrase:", round(cos(a, b), 3))
print("job vs biryani:", round(cos(a, c), 3))