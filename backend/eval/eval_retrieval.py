from app.db.session import SessionLocal
from app.services.memory import search_memory

# Each case: a query, and which decision id we expect to be the top or near-top result
TEST_CASES = [
    {"query": "is it a good idea to change employers?", "expected_source_id": 4, "expected_table": "decisions"},
    {"query": "how did my decision about the startup turn out?", "expected_source_id": 4, "expected_table": "feedback"},
    {"query": "should I buy new hardware for machine learning?", "expected_source_id": 3, "expected_table": "decisions"},
    {"query": "is freelance work worth it?", "expected_source_id": 2, "expected_table": "decisions"},
]

def run_eval(user_id: int = 2, k: int = 3):
    db = SessionLocal()
    hits, total = 0, len(TEST_CASES)
    for case in TEST_CASES:
        results = search_memory(db, user_id, case["query"], k=k)
        found = any(
            r["source_id"] == case["expected_source_id"] and r["source_table"] == case["expected_table"]
            for r in results
        )
        hits += found
        print(f"[{'HIT' if found else 'MISS'}] \"{case['query']}\"")
        for r in results:
            print(f"    - {r['source_table']}#{r['source_id']} dist={r['distance']}")
    db.close()
    print(f"\nPrecision@{k}: {hits}/{total} = {hits/total:.0%}")

if __name__ == "__main__":
    run_eval()