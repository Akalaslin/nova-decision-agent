from app.services.llm import generate

JUDGE_PROMPT = """You are evaluating an AI assistant's answer for quality. Score from 1-5 on each:
1. Groundedness: Does it only use facts present in the given context (no invented facts)?
2. Constraint adherence: Does it respect the user's stated constraints?
3. Actionability: Does it give concrete next steps?

Return ONLY in this exact format:
Groundedness: <score>
Constraint adherence: <score>
Actionability: <score>
Explanation: <one sentence>"""

def judge(context: str, question: str, answer: str) -> str:
    prompt = f"CONTEXT GIVEN TO THE ASSISTANT:\n{context}\n\nQUESTION:\n{question}\n\nASSISTANT'S ANSWER:\n{answer}"
    return generate(JUDGE_PROMPT, prompt, use_tools=False)

if __name__ == "__main__":
       context = """GOALS: Switch to a GenAI Engineer role (learning the full GenAI stack via NOVA project)
CONSTRAINTS: Must earn at least current salary (budget)
PAST DECISION #4: Should I leave my company for a startup? -> Stay 6 more months (reasoning: startup pays less but has faster learning)
PAST DECISION #2: Should I accept a freelance data project? -> Decline for now (reasoning: extra income but eats weekends)
DOCUMENT EXCERPT [Offer_Letter(NOVA_AI).txt, part 4]: Benefits: Health insurance covers you and your spouse. A learning budget of 30,000 rupees per year is provided for courses and certifications.
DOCUMENT EXCERPT [Offer_Letter(NOVA_AI).txt, part 5]: Confidentiality: You must not share company data, code or client information during or after employment."""
question = "I got an offer from another company with higher pay. Should I take it?"
answer = """1) Decision framing
You are evaluating whether to accept an external job offer that provides higher pay, weighed against your primary goal of switching to a GenAI Engineer role by learning the full GenAI stack via the NOVA project, and your budget constraint to maintain or increase your current salary.

* Goal Alignment: Does the new offer advance your GenAI learning path (via the NOVA project)?
* Financial Constraint: The offer provides higher pay, which satisfies your budget constraint (must earn at least your current salary).
* Historical Context: Earlier, you decided to stay 6 more months at your current company after negotiating a raise [Past decision #4], successfully prioritizing stability and learning at that time. You also previously declined a freelance project to protect your personal time [Past decision #2].

2) Options with pros and cons

Option A: Accept the external offer
Pros:
* Potentially offers a fresh environment or direct alignment with your GenAI career transition goals (depending on the role's actual duties).
* Includes benefits and terms outlined in the offer letter (e.g., 30,000 rupees annual learning budget, health insurance for you and your spouse) [Doc: Offer_Letter(NOVA_AI).txt, part 4].
Cons:
* Disrupts your current stability and ongoing projects (including the NOVA project learning path).
* Carries transition risks and potential notice period obligations from your current employer.
* Strict confidentiality clauses will apply regarding company data and code [Doc: Offer_Letter(NOVA_AI).txt, part 5].

Option B: Decline the offer and stay
Pros:
* Keeps you aligned with your past decision to stay and build your skills systematically [Past decision #4].
* Maintains continuity on your GenAI learning path (NOVA project) without the distraction of onboarding at a new company.
* Predictable work environment where you recently secured a raise [Past decision #4].
Cons:
* You miss out on the higher pay offered by the external company.
* If your current role lacks stack exposure, staying might slow your target transition to a GenAI Engineer role.

3) Recommendation
Accept the offer only if the new role explicitly involves hands-on GenAI stack work (not just higher pay for similar responsibilities); otherwise, decline and stay, consistent with your prior decision, since you already addressed compensation through a raise.

4) Next actions
* Ask the new company for a detailed description of day-to-day GenAI/ML responsibilities before deciding.
* Compare the new offer's learning budget and benefits directly against your current employer's.
* Check your current contract's notice period before making any commitment.
* Re-evaluate against your NOVA project timeline to see which path gets you to a GenAI Engineer role faster."""
print(judge(context, question, answer))