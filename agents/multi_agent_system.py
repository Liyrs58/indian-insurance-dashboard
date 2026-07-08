"""
Multi-Agent Insurance Market Analysis System
Built with CrewAI-style architecture using native OpenAI calls.
"""
import json
import os
from pathlib import Path
from typing import Any

DATA_PATH = Path(__file__).parent.parent / "data" / "irdai-data.json"

with open(DATA_PATH) as f:
    MARKET_DATA = json.load(f)


class Agent:
    def __init__(self, name: str, role: str, goal: str, backstory: str, tools: list | None = None):
        self.name = name
        self.role = role
        self.goal = goal
        self.backstory = backstory
        self.tools = tools or []

    def __repr__(self) -> str:
        return f"Agent({self.name}, {self.role})"


class Task:
    def __init__(self, description: str, expected_output: str, agent: Agent):
        self.description = description
        self.expected_output = expected_output
        self.agent = agent

    def __repr__(self) -> str:
        return f"Task({self.description[:40]}..., agent={self.agent.name})"


class Crew:
    def __init__(self, agents: list[Agent], tasks: list[Task]):
        self.agents = agents
        self.tasks = tasks

    def run(self) -> dict[str, Any]:
        results = {}
        for task in self.tasks:
            print(f"\n  Agent: {task.agent.name}")
            print(f"  Task: {task.description}")
            result = self._execute_task(task)
            results[task.agent.name] = result
            print(f"  Result: {result[:120]}...")
        return results

    def _execute_task(self, task: Task) -> str:
        agent = task.agent
        context = self._build_context(task)
        prompt = f"""You are {agent.name}, {agent.role}.
Goal: {agent.goal}
Backstory: {agent.backstory}

Context data: {json.dumps(context, indent=2)}

Task: {task.description}

Expected output: {task.expected_output}

Provide your analysis based on the data above."""
        return self._llm_response(prompt)

    def _build_context(self, task: Task) -> dict:
        return MARKET_DATA

    def _llm_response(self, prompt: str) -> str:
        try:
            from openai import OpenAI
            api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
            base_url = os.environ.get("OPENAI_BASE_URL")
            if not base_url and not os.environ.get("OPENAI_API_KEY"):
                base_url = "https://openrouter.ai/api/v1"
            if api_key:
                client = OpenAI(api_key=api_key, base_url=base_url)
            else:
                client = OpenAI()
            resp = client.chat.completions.create(
                model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1200,
            )
            return resp.choices[0].message.content
        except Exception:
            return self._local_analysis(prompt)

    def _local_analysis(self, prompt: str) -> str:
        import re
        m = re.search(r"Task: (.+)", prompt)
        task_desc = m.group(1) if m else "analyze the data"
        m2 = re.search(r"Your analysis", prompt)
        return f"[Local analysis mode] Based on IRDAI data: {task_desc[:80]}... (Set OPENAI_API_KEY for LLM-powered analysis)"


# --- Define Agents ---

data_scientist = Agent(
    name="Ravi",
    role="Senior Insurance Data Analyst",
    goal="Extract meaningful patterns from Indian insurance market data",
    backstory="10 years analysing insurance data at IRDAI. Expert in market trends and penetration metrics.",
)

strategy_consultant = Agent(
    name="Priya",
    role="Strategy Consultant — Fintech & Insurance",
    goal="Identify growth opportunities and strategic recommendations",
    backstory="Former McKinsey consultant specializing in Indian BFSI. Deep knowledge of insurance distribution channels and digital disruption.",
)

report_writer = Agent(
    name="Arjun",
    role="Report Compiler & Editor",
    goal="Synthesize findings into a clear, actionable executive report",
    backstory="Business journalist turned analyst. Specializes in translating complex insurance data into executive-ready insights.",
)


if __name__ == "__main__":
    print("=" * 60)
    print("  INDIAN INSURANCE MARKET — Multi-Agent Analysis")
    print("=" * 60)

    tasks = [
        Task(
            description="Analyze the premium trends from 2014-2024. Identify the growth trajectory of life vs non-life segments. Calculate CAGR and highlight inflection points.",
            expected_output="A bullet-point analysis of premium trends with CAGR figures for life, non-life, and total segments.",
            agent=data_scientist,
        ),
        Task(
            description="Based on the market share data and global comparison, identify the top 3 strategic opportunities for a digital insurance distributor like Paytm Insurance Broking. Consider: low penetration in non-life, digital distribution gap, and the 'Insurance for All by 2047' initiative.",
            expected_output="3 specific strategic recommendations with market size estimates and rationale.",
            agent=strategy_consultant,
        ),
        Task(
            description="Compile the data scientist's trend analysis and the strategist's recommendations into a one-page executive brief. Structure: Market Overview → Key Trends → Strategic Opportunities → Data Appendix.",
            expected_output="A structured executive brief in markdown format.",
            agent=report_writer,
        ),
    ]

    crew = Crew(agents=[data_scientist, strategy_consultant, report_writer], tasks=tasks)

    print("\n  Launching Crew...\n")
    results = crew.run()

    print("\n" + "=" * 60)
    print("  EXECUTIVE BRIEF")
    print("=" * 60)
    if "Arjun" in results:
        print(results["Arjun"])
    else:
        for agent_name, result in results.items():
            print(f"\n-- {agent_name} --\n{result}\n")
