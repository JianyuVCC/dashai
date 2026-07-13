from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone

from google import genai
from google.genai import types

from config import get_settings
from models.schemas import ChartConfig, ChatMessage, Dashboard

MODEL = "gemini-2.5-flash"

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


def _dataset_context(summary: dict) -> str:
    return f"""Dataset summary:
- Rows: {summary['rows']}
- Columns: {summary['columns']}
- Numeric columns: {summary.get('numeric_columns', [])}
- Categorical columns: {summary.get('categorical_columns', [])}
- Datetime columns: {summary.get('datetime_columns', [])}
- Sample data (first 3 rows): {json.dumps(summary.get('preview', [])[:3], default=str)}
"""


def _chart_schema() -> types.Schema:
    return types.Schema(
        type=types.Type.OBJECT,
        properties={
            "id": types.Schema(type=types.Type.STRING),
            "type": types.Schema(
                type=types.Type.STRING,
                enum=["bar", "line", "pie", "scatter", "area", "table"],
            ),
            "title": types.Schema(type=types.Type.STRING),
            "x_column": types.Schema(type=types.Type.STRING),
            "y_column": types.Schema(type=types.Type.STRING),
            "y_columns": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.STRING),
            ),
            "color_column": types.Schema(type=types.Type.STRING),
            "aggregation": types.Schema(
                type=types.Type.STRING,
                enum=["sum", "count", "mean", "max", "min", "median"],
            ),
        },
        required=["id", "type", "title"],
    )


def _layout_item_schema() -> types.Schema:
    return types.Schema(
        type=types.Type.OBJECT,
        properties={
            "i": types.Schema(type=types.Type.STRING),
            "x": types.Schema(type=types.Type.INTEGER),
            "y": types.Schema(type=types.Type.INTEGER),
            "w": types.Schema(type=types.Type.INTEGER),
            "h": types.Schema(type=types.Type.INTEGER),
        },
        required=["i", "x", "y", "w", "h"],
    )


def _make_dashboard_tool(name: str, description: str) -> types.Tool:
    fn = types.FunctionDeclaration(
        name=name,
        description=description,
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "title": types.Schema(type=types.Type.STRING, description="Dashboard title"),
                "description": types.Schema(type=types.Type.STRING, description="Brief description"),
                "charts": types.Schema(
                    type=types.Type.ARRAY,
                    items=_chart_schema(),
                ),
                "layout": types.Schema(
                    type=types.Type.ARRAY,
                    items=_layout_item_schema(),
                ),
            },
            required=["title", "charts", "layout"],
        ),
    )
    return types.Tool(function_declarations=[fn])


def _extract_fn_call(response, name: str) -> dict | None:
    for candidate in response.candidates:
        for part in candidate.content.parts:
            if hasattr(part, "function_call") and part.function_call.name == name:
                return dict(part.function_call.args)
    return None


def _extract_text(response) -> str:
    parts = []
    for candidate in response.candidates:
        for part in candidate.content.parts:
            if hasattr(part, "text") and part.text:
                parts.append(part.text)
    return " ".join(parts)


def _charts_from_input(tool_input: dict) -> list[ChartConfig]:
    return [
        ChartConfig(
            id=c.get("id", str(uuid.uuid4())),
            type=c["type"],
            title=c["title"],
            x_column=c.get("x_column"),
            y_column=c.get("y_column"),
            y_columns=list(c.get("y_columns", [])) or None,
            color_column=c.get("color_column"),
            aggregation=c.get("aggregation"),
        )
        for c in tool_input["charts"]
    ]


async def generate_dashboard(dataset_id: str, summary: dict, user_prompt: str = "") -> Dashboard:
    system = """You are an expert data analyst and dashboard designer. When given a dataset,
create insightful, well-organized dashboards with the most relevant visualizations.

Guidelines:
- Choose chart types that best represent the data relationships
- Bar/column charts for comparisons, line/area for trends, pie for composition, scatter for correlation
- Always aggregate data appropriately (sum, count, mean) so charts are readable
- Create 4-6 charts per dashboard for a clean, focused view
- Layout: 12 columns wide. Use w=6,h=5 for half-width or w=12,h=5 for full-width charts
- x values: 0 or 6; y values increment by 5 per row
- Give charts clear, descriptive titles
- Always call the create_dashboard function with your result"""

    context = _dataset_context(summary)
    user_msg = (
        f"{context}\n\n"
        f"{'User request: ' + user_prompt if user_prompt else 'Generate an insightful dashboard for this dataset.'}"
    )

    tool = _make_dashboard_tool(
        "create_dashboard",
        "Create a dashboard configuration with charts based on the dataset.",
    )

    tool_input = None
    messages = [user_msg]

    for _attempt in range(2):
        response = await _get_client().aio.models.generate_content(
            model=MODEL,
            contents=messages,
            config=types.GenerateContentConfig(
                system_instruction=system,
                tools=[tool],
                tool_config=types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(
                        mode=types.FunctionCallingMode.AUTO,
                    )
                ),
            ),
        )
        tool_input = _extract_fn_call(response, "create_dashboard")
        if tool_input:
            break
        messages.append(_extract_text(response) or "")
        messages.append("You must call the create_dashboard function with your dashboard design now.")

    if not tool_input:
        raise RuntimeError("The AI did not produce a dashboard configuration.")

    now = datetime.now(timezone.utc)
    return Dashboard(
        id=str(uuid.uuid4()),
        title=tool_input["title"],
        dataset_id=dataset_id,
        charts=_charts_from_input(tool_input),
        layout=list(tool_input["layout"]),
        created_at=now,
        updated_at=now,
        description=tool_input.get("description", ""),
    )


async def modify_dashboard(
    dashboard: Dashboard,
    summary: dict,
    message: str,
    history: list[ChatMessage],
    allow_modify: bool = True,
) -> tuple[str, Dashboard | None]:
    context = _dataset_context(summary)
    dashboard_context = (
        f'Current dashboard: "{dashboard.title}"\n'
        f"Charts: {json.dumps([{'id': c.id, 'type': c.type, 'title': c.title, 'x_column': c.x_column, 'y_column': c.y_column} for c in dashboard.charts], default=str)}"
    )

    if allow_modify:
        system = """You are a dashboard assistant. Help users modify their dashboards by understanding
their requests and either:
1. Calling modify_dashboard when chart changes are requested
2. Answering questions conversationally when no chart changes are needed

When modifying, preserve chart IDs for unchanged charts. New charts get new UUIDs."""
        tool = _make_dashboard_tool("modify_dashboard", "Update the dashboard configuration.")
        tool_config = types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(
                mode=types.FunctionCallingMode.AUTO,
            )
        )
    else:
        system = """You are a read-only assistant for a public dashboard. Answer questions about
the data conversationally. You cannot modify the dashboard."""
        tool = None
        tool_config = None

    contents: list = []
    for m in history[-10:]:
        contents.append(
            types.Content(
                role="user" if m.role == "user" else "model",
                parts=[types.Part(text=m.content)],
            )
        )
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=f"{context}\n{dashboard_context}\n\nUser: {message}")],
        )
    )

    cfg_kwargs: dict = {"system_instruction": system}
    if tool:
        cfg_kwargs["tools"] = [tool]
        cfg_kwargs["tool_config"] = tool_config

    response = await _get_client().aio.models.generate_content(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(**cfg_kwargs),
    )

    reply = _extract_text(response)
    tool_input = _extract_fn_call(response, "modify_dashboard") if allow_modify else None
    updated_dashboard = None

    if tool_input:
        now = datetime.now(timezone.utc)
        updated_dashboard = Dashboard(
            id=dashboard.id,
            title=tool_input["title"],
            dataset_id=dashboard.dataset_id,
            charts=_charts_from_input(tool_input),
            layout=list(tool_input["layout"]),
            is_public=dashboard.is_public,
            public_slug=dashboard.public_slug,
            created_at=dashboard.created_at,
            updated_at=now,
            description=tool_input.get("description", dashboard.description),
        )
        if not reply or reply.strip() in ("", "Dashboard updated."):
            reply = f"I've updated the dashboard: {updated_dashboard.title}."

    return reply or "Done.", updated_dashboard
