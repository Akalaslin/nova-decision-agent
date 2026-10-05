from langgraph.graph import StateGraph, END
from app.agent.state import AgentState
from app.agent.nodes import (
    load_context_node, retrieve_memory_node, has_documents_node,
    retrieve_docs_node, generate_answer_node,
)

def route_after_check(state):
    return "retrieve_docs" if state["_has_docs"] else "generate_answer"

def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("load_context", load_context_node)
    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("has_documents", has_documents_node)
    graph.add_node("retrieve_docs", retrieve_docs_node)
    graph.add_node("generate_answer", generate_answer_node)

    graph.set_entry_point("load_context")
    graph.add_edge("load_context", "retrieve_memory")
    graph.add_edge("retrieve_memory", "has_documents")
    graph.add_conditional_edges("has_documents", route_after_check, {
        "retrieve_docs": "retrieve_docs",
        "generate_answer": "generate_answer",
    })
    graph.add_edge("retrieve_docs", "generate_answer")
    graph.add_edge("generate_answer", END)

    return graph.compile()

nova_graph = build_graph()