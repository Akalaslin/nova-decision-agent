from app.core.config import settings

PROFILES = {
    "general": {
        "subtitle": "Command Center",
        "tagline": "Personal Decision Intelligence",
        "welcome": (
            "Hi, I'm **NOVA**, your personal decision assistant.\n\n"
            "I remember your goals, constraints and past decisions, and I can read documents you upload. "
            "Ask me about a decision, or try one of the suggestions below."
        ),
        "suggestions": [
            "I got a job offer with higher pay. Should I take it?",
            "What did I decide about the startup?",
            "Does my offer letter mention stock options?",
        ],
        "goals_label": "Goals",
        "constraints_label": "Constraints",
        "documents_label": "Documents",
        "guidance": "",
    },
    "career": {
        "subtitle": "Career Command Center",
        "tagline": "Your career decisions, remembered",
        "welcome": (
            "Hi, I'm **NOVA Career**.\n\n"
            "I remember your career goals, your must-haves and the decisions you've made, and I can read your "
            "resume and offer letters. Ask me about an offer, an application or your next step."
        ),
        "suggestions": [
            "Should I apply now or finish my portfolio project first?",
            "Compare two job offers using my goals and limits",
            "What skills am I missing for a GenAI Engineer role?",
        ],
        "goals_label": "Career goals",
        "constraints_label": "Must-haves",
        "documents_label": "Resume & offers",
        "guidance": (
            "This assistant helps with career decisions: job offers, applications, skills, interviews and negotiation. "
            "Prefer concrete steps (what to apply to, what to learn, what to ask). When comparing offers, compare pay, "
            "learning, growth, notice period, probation and risks, and say clearly which numbers are missing."
        ),
    },
    "study": {
        "subtitle": "Study Command Center",
        "tagline": "Your study decisions, remembered",
        "welcome": (
            "Hi, I'm **NOVA Study**.\n\n"
            "I remember your study goals, your time limits and what you've decided before, and I can read your "
            "notes and syllabus. Ask me what to study, how to split your time, or how to plan for an exam."
        ),
        "suggestions": [
            "Make a 4-week study plan for my exam",
            "Should I revise the syllabus again or practise past papers?",
            "How should I split my 3 hours a day between subjects?",
        ],
        "goals_label": "Study goals",
        "constraints_label": "Time & limits",
        "documents_label": "Notes & syllabus",
        "guidance": (
            "This assistant helps students decide what to study and when. Use the exam date, hours per day and weak "
            "topics when they are known, and ask for them when missing. Prefer small weekly plans over big vague ones, "
            "and include time for revision and rest."
        ),
    },
    "business": {
        "subtitle": "Business Command Center",
        "tagline": "Your business decisions, remembered",
        "welcome": (
            "Hi, I'm **NOVA Business**.\n\n"
            "I remember your business goals, your budget limits and the decisions you've made, and I can read your "
            "contracts and reports. Ask me about hiring, pricing, launches or suppliers."
        ),
        "suggestions": [
            "Should I hire now or wait a quarter?",
            "Is this price change worth the risk?",
            "What could go wrong if I launch in a new city?",
        ],
        "goals_label": "Business goals",
        "constraints_label": "Budget & limits",
        "documents_label": "Contracts & reports",
        "guidance": (
            "This assistant helps small business owners and founders decide on hiring, pricing, launches and suppliers. "
            "Ask for the numbers that matter (cost, revenue, runway) when they are missing, and show simple "
            "calculations. This is not licensed financial or legal advice."
        ),
    },
}


def get_profile(name=None):
    key = (name or settings.nova_profile or "general").strip().lower()
    if key not in PROFILES:
        key = "general"
    return {"id": key, **PROFILES[key]}