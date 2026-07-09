"""
Generic Excel Dashboarding Tool
--------------------------------
Upload ANY Excel (.xlsx/.xls) or CSV file and the app auto-profiles the data
and builds an interactive dashboard: KPI cards, filters, and configurable charts.

No file structure is hard-coded. Column types are inferred at runtime, so the
same app works for any spreadsheet a user uploads later.

Designed to run as a stateless container (uploaded data is held in the browser
session only, never written to disk) so it is safe to deploy behind corporate
SSO on a private cloud.
"""

import base64
import io
import json
import os

import dash
from dash import Dash, dcc, html, dash_table, Input, Output, State, callback, no_update
import pandas as pd
import plotly.express as px

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Dash(__name__, suppress_callback_exceptions=True, title="Dashboard Builder")
# `server` is the WSGI entrypoint gunicorn/Azure looks for.
server = app.server

MAX_CATEGORIES = 30        # categorical columns with more uniques are treated as free text
MAX_PREVIEW_ROWS = 100

# Brand palette derived from the corporate slide template:
# white background, light-grey panels, black text, bold red-orange accent.
ACCENT = "#F8511F"
# Categorical chart sequence: accent orange + industrial greys (matches the deck).
BRAND_SEQUENCE = ["#F8511F", "#2C2C2C", "#8A8A8A", "#C23A12",
                  "#5A5A5A", "#FBA07F", "#B0B0B0", "#7A1E08"]

# ---------------------------------------------------------------------------
# Data profiling helpers
# ---------------------------------------------------------------------------

def parse_upload(contents: str, filename: str) -> dict:
    """Decode an uploaded file into {sheet_name: records}. Raises ValueError on bad input."""
    content_type, content_string = contents.split(",", 1)
    decoded = base64.b64decode(content_string)
    name = (filename or "").lower()

    sheets: dict[str, pd.DataFrame] = {}
    if name.endswith(".csv") or name.endswith(".tsv"):
        sep = "\t" if name.endswith(".tsv") else ","
        sheets["Sheet1"] = pd.read_csv(io.BytesIO(decoded), sep=sep)
    elif name.endswith(".xlsx") or name.endswith(".xls") or name.endswith(".xlsm"):
        xls = pd.read_excel(io.BytesIO(decoded), sheet_name=None)  # all sheets
        sheets = {k: v for k, v in xls.items()}
    else:
        raise ValueError("Unsupported file type. Upload a .xlsx, .xls, .xlsm, .csv or .tsv file.")

    # Drop fully-empty sheets, store as JSON-serialisable records.
    out = {}
    for sheet, df in sheets.items():
        df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")
        if df.empty:
            continue
        # Normalise column names to strings.
        df.columns = [str(c) for c in df.columns]
        out[str(sheet)] = df.to_json(date_format="iso", orient="split")
    if not out:
        raise ValueError("No readable data found in the file.")
    return out


def load_df(stored_sheet_json: str) -> pd.DataFrame:
    df = pd.read_json(io.StringIO(stored_sheet_json), orient="split")
    return _coerce_types(df)


def _coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Try to recover datetime / numeric columns that came through as objects."""
    for col in df.columns:
        if df[col].dtype == object:
            # Try datetime first (only accept if most values parse).
            parsed = pd.to_datetime(df[col], errors="coerce")
            if parsed.notna().mean() > 0.8:
                df[col] = parsed
                continue
            num = pd.to_numeric(df[col], errors="coerce")
            if num.notna().mean() > 0.8:
                df[col] = num
    return df


def classify_columns(df: pd.DataFrame) -> dict:
    numeric, datetime_cols, categorical, text = [], [], [], []
    for col in df.columns:
        s = df[col]
        if pd.api.types.is_datetime64_any_dtype(s):
            datetime_cols.append(col)
        elif pd.api.types.is_numeric_dtype(s):
            numeric.append(col)
        else:
            if s.nunique(dropna=True) <= MAX_CATEGORIES:
                categorical.append(col)
            else:
                text.append(col)
    return {"numeric": numeric, "datetime": datetime_cols,
            "categorical": categorical, "text": text}


# ---------------------------------------------------------------------------
# AI Q&A (Azure OpenAI) — keeps data inside your tenant
# ---------------------------------------------------------------------------
# Configure via environment variables (set on the Container App):
#   AZURE_OPENAI_ENDPOINT      e.g. https://my-aoai.openai.azure.com
#   AZURE_OPENAI_DEPLOYMENT    your chat model deployment name (e.g. gpt-4o)
#   AZURE_OPENAI_API_VERSION   e.g. 2024-06-01  (optional, has a default)
#   AZURE_OPENAI_API_KEY       key auth  — OR omit and use managed identity
#   AI_SAMPLE_ROWS             rows of sample data sent for context (default 5)

AI_ENABLED = bool(os.getenv("AZURE_OPENAI_ENDPOINT") and os.getenv("AZURE_OPENAI_DEPLOYMENT"))
AI_SAMPLE_ROWS = int(os.getenv("AI_SAMPLE_ROWS", "5"))


def build_data_context(df: pd.DataFrame, types: dict) -> str:
    """Compact, model-friendly summary of the active sheet (schema + stats + small sample)."""
    lines = [f"Rows: {len(df)}, Columns: {df.shape[1]}", "", "Columns:"]
    for col in df.columns:
        s = df[col]
        if col in types["numeric"]:
            lines.append(f"- {col} (numeric): min={s.min():.4g}, max={s.max():.4g}, "
                         f"mean={s.mean():.4g}, median={s.median():.4g}, sum={s.sum():.4g}")
        elif col in types["datetime"]:
            lines.append(f"- {col} (date): from {s.min()} to {s.max()}")
        elif col in types["categorical"]:
            vc = s.value_counts().head(10)
            cats = ", ".join(f"{k}={v}" for k, v in vc.items())
            lines.append(f"- {col} (category, {s.nunique()} unique): {cats}")
        else:
            lines.append(f"- {col} (text): {s.nunique()} unique values")
    if AI_SAMPLE_ROWS > 0:
        lines += ["", f"Sample rows (first {AI_SAMPLE_ROWS}):",
                  df.head(AI_SAMPLE_ROWS).to_csv(index=False)]
    return "\n".join(lines)


def ask_ai(question: str, context: str) -> str:
    """Send the question + data context to Azure OpenAI. Returns the answer text."""
    if not AI_ENABLED:
        return ("AI is not configured. Set AZURE_OPENAI_ENDPOINT and "
                "AZURE_OPENAI_DEPLOYMENT (plus a key or managed identity) on the "
                "Container App to enable data Q&A.")
    try:
        from openai import AzureOpenAI
    except ImportError:
        return "The 'openai' package is not installed in this image."

    endpoint = os.environ["AZURE_OPENAI_ENDPOINT"]
    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")

    try:
        if api_key:
            client = AzureOpenAI(azure_endpoint=endpoint, api_key=api_key,
                                 api_version=api_version)
        else:
            # Managed identity / DefaultAzureCredential — no secrets in the app.
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider
            token_provider = get_bearer_token_provider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default")
            client = AzureOpenAI(azure_endpoint=endpoint,
                                 azure_ad_token_provider=token_provider,
                                 api_version=api_version)

        system = ("You are a precise data analyst. Answer the user's question using ONLY "
                  "the dataset summary provided. Give concrete numbers from the summary. "
                  "If the summary is insufficient to answer exactly, say so and suggest "
                  "which chart or filter would reveal it. Be concise.")
        resp = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "system", "content": system},
                      {"role": "user",
                       "content": f"Dataset summary:\n{context}\n\nQuestion: {question}"}],
            temperature=0.2, max_tokens=500)
        return resp.choices[0].message.content.strip()
    except Exception as e:  # noqa: BLE001
        return f"AI request failed: {e}"


# ---------------------------------------------------------------------------
# UI building helpers
# ---------------------------------------------------------------------------

def kpi_card(title, value, sub=""):
    return html.Div(className="kpi", children=[
        html.Div(title, className="kpi-title"),
        html.Div(value, className="kpi-value"),
        html.Div(sub, className="kpi-sub"),
    ])


def build_kpis(df: pd.DataFrame, types: dict):
    cards = [kpi_card("Rows", f"{len(df):,}"),
             kpi_card("Columns", f"{df.shape[1]:,}")]
    for col in types["numeric"][:4]:
        total = df[col].sum()
        mean = df[col].mean()
        cards.append(kpi_card(col, f"{total:,.0f}", f"avg {mean:,.2f}"))
    return cards


def control_dropdown(id_, label, options, value=None, clearable=True):
    return html.Div(className="control", children=[
        html.Label(label),
        dcc.Dropdown(id=id_, options=[{"label": o, "value": o} for o in options],
                     value=value, clearable=clearable),
    ])


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------
app.layout = html.Div(className="wrap", children=[
    dcc.Store(id="store-data"),       # {sheet: json}
    dcc.Store(id="store-sheet"),      # active sheet name

    html.Header(className="topbar", children=[
        html.Div("Dashboard Builder", className="brand"),
        html.Div("Upload any spreadsheet → instant dashboard", className="tag"),
    ]),

    dcc.Upload(
        id="upload",
        className="upload",
        children=html.Div(["Drag & drop or ", html.A("choose an Excel / CSV file")]),
        multiple=False,
    ),
    html.Div(id="upload-msg", className="msg"),

    html.Div(id="sheet-picker-row"),
    html.Div(id="dashboard"),

    html.Footer(className="foot", children=[
        "Data stays in your browser session — nothing is written to the server."
    ]),

    # ---- Floating AI assistant (fixed bottom-right) ----
    dcc.Store(id="ai-open", data=False),
    html.Button("Ask AI", id="ai-fab", className="ai-fab", n_clicks=0,
                title="Ask AI about your data"),
    html.Div(id="ai-box", className="ai-box ai-hidden", children=[
        html.Div(className="ai-box-head", children=[
            html.Div(children=[
                html.Div("Ask AI about your data", className="ai-title"),
                html.Div("Azure OpenAI · stays in your tenant", className="ai-badge"),
            ]),
            html.Button("×", id="ai-close", className="ai-close", n_clicks=0),
        ]),
        dcc.Loading(html.Div(id="ai-answer", className="ai-answer"), type="dot"),
        html.Div(className="ai-row", children=[
            dcc.Input(id="ai-q", type="text", className="ai-input",
                      placeholder="Ask a question about your sheet…",
                      debounce=True, n_submit=0),
            html.Button("Send", id="ai-ask", className="ai-send", n_clicks=0),
        ]),
    ]),
])


# ---------------------------------------------------------------------------
# Callbacks
# ---------------------------------------------------------------------------
@callback(
    Output("store-data", "data"),
    Output("upload-msg", "children"),
    Output("sheet-picker-row", "children"),
    Output("store-sheet", "data"),
    Input("upload", "contents"),
    State("upload", "filename"),
    prevent_initial_call=True,
)
def on_upload(contents, filename):
    if not contents:
        return no_update, no_update, no_update, no_update
    try:
        sheets = parse_upload(contents, filename)
    except Exception as e:  # noqa: BLE001
        return None, html.Span(f"⚠️ {e}", className="err"), None, None

    names = list(sheets.keys())
    msg = html.Span(f"Loaded “{filename}” — {len(names)} sheet(s).", className="ok")
    picker = None
    if len(names) > 1:
        picker = html.Div(className="control", children=[
            html.Label("Sheet"),
            dcc.Dropdown(id="sheet-dd",
                         options=[{"label": n, "value": n} for n in names],
                         value=names[0], clearable=False),
        ])
    else:
        # Hidden dropdown keeps the callback wiring uniform.
        picker = dcc.Dropdown(id="sheet-dd", options=[{"label": names[0], "value": names[0]}],
                              value=names[0], style={"display": "none"})
    return sheets, msg, picker, names[0]


@callback(
    Output("dashboard", "children"),
    Input("store-data", "data"),
    Input("sheet-dd", "value"),
    prevent_initial_call=True,
)
def build_dashboard(data, sheet):
    if not data or not sheet or sheet not in data:
        return None
    df = load_df(data[sheet])
    types = classify_columns(df)

    numeric = types["numeric"]
    cat = types["categorical"]
    dt = types["datetime"]
    all_cols = list(df.columns)

    # Sensible chart defaults.
    default_x = (dt + cat + all_cols)[0] if (dt or cat or all_cols) else None
    default_y = numeric[0] if numeric else None
    default_color = cat[0] if cat else None
    chart_types = ["Bar", "Line", "Scatter", "Box", "Histogram", "Pie"]

    filters = []
    for c in cat[:4]:
        opts = sorted([str(v) for v in df[c].dropna().unique()])
        filters.append(html.Div(className="control", children=[
            html.Label(f"Filter: {c}"),
            dcc.Dropdown(id={"type": "filter", "col": c},
                         options=[{"label": o, "value": o} for o in opts],
                         multi=True, placeholder="All"),
        ]))

    return html.Div([
        html.Div(className="kpis", children=build_kpis(df, types)),

        html.Div(className="panel", children=[
            html.Div(className="controls", children=[
                control_dropdown("dd-chart", "Chart type", chart_types, "Bar", clearable=False),
                control_dropdown("dd-x", "X axis", all_cols, default_x, clearable=False),
                control_dropdown("dd-y", "Y axis (measure)", numeric, default_y),
                control_dropdown("dd-color", "Group / colour", cat, default_color),
                control_dropdown("dd-agg", "Aggregate", ["sum", "mean", "count", "none"], "sum",
                                 clearable=False),
            ]),
            html.Div(className="controls", children=filters) if filters else None,
            dcc.Graph(id="main-graph"),
        ]),

        html.Details(className="panel", children=[
            html.Summary("Data preview & column profile"),
            html.Div(className="profile", children=_profile_table(df, types)),
            dash_table.DataTable(
                data=df.head(MAX_PREVIEW_ROWS).to_dict("records"),
                columns=[{"name": c, "id": c} for c in df.columns],
                page_size=10, style_table={"overflowX": "auto"},
                style_cell={"fontSize": "13px", "padding": "6px",
                            "fontFamily": "system-ui"},
                style_header={"fontWeight": "600", "backgroundColor": "#f3f4f6"},
            ),
        ]),
    ])


def _profile_table(df, types):
    rev = {}
    for t, cols in types.items():
        for c in cols:
            rev[c] = t
    rows = []
    for c in df.columns:
        s = df[c]
        rows.append(html.Tr([
            html.Td(c), html.Td(rev.get(c, "?")),
            html.Td(f"{s.notna().sum():,}"),
            html.Td(f"{s.nunique(dropna=True):,}"),
        ]))
    return html.Table(className="ptable", children=[
        html.Thead(html.Tr([html.Th("Column"), html.Th("Type"),
                            html.Th("Non-null"), html.Th("Unique")])),
        html.Tbody(rows),
    ])


@callback(
    Output("ai-box", "className"),
    Output("ai-open", "data"),
    Input("ai-fab", "n_clicks"),
    Input("ai-close", "n_clicks"),
    State("ai-open", "data"),
    prevent_initial_call=True,
)
def toggle_ai(fab_clicks, close_clicks, is_open):
    opened = dash.ctx.triggered_id == "ai-fab"
    return ("ai-box" if opened else "ai-box ai-hidden"), opened


@callback(
    Output("ai-answer", "children"),
    Input("ai-ask", "n_clicks"),
    Input("ai-q", "n_submit"),
    State("ai-q", "value"),
    State("store-data", "data"),
    State("sheet-dd", "value"),
    prevent_initial_call=True,
)
def answer_question(n_clicks, n_submit, question, data, sheet):
    if not question or not question.strip():
        return ""
    if not data or not sheet or sheet not in data:
        return "Upload a spreadsheet first, then ask a question about it."
    df = load_df(data[sheet])
    types = classify_columns(df)
    context = build_data_context(df, types)
    answer = ask_ai(question.strip(), context)
    return dcc.Markdown(answer)


@callback(
    Output("main-graph", "figure"),
    Input("dd-chart", "value"),
    Input("dd-x", "value"),
    Input("dd-y", "value"),
    Input("dd-color", "value"),
    Input("dd-agg", "value"),
    Input({"type": "filter", "col": dash.ALL}, "value"),
    State({"type": "filter", "col": dash.ALL}, "id"),
    State("store-data", "data"),
    State("sheet-dd", "value"),
    prevent_initial_call=True,
)
def update_graph(chart, x, y, color, agg, filter_vals, filter_ids, data, sheet):
    if not data or not sheet or sheet not in data or not x:
        return _empty_fig("Pick axes to build a chart")
    df = load_df(data[sheet])

    # Apply categorical filters.
    for vals, fid in zip(filter_vals or [], filter_ids or []):
        if vals:
            col = fid["col"]
            df = df[df[col].astype(str).isin([str(v) for v in vals])]
    if df.empty:
        return _empty_fig("No rows match the current filters")

    try:
        fig = _make_fig(df, chart, x, y, color, agg)
    except Exception as e:  # noqa: BLE001
        return _empty_fig(f"Could not draw chart: {e}")
    fig.update_layout(margin=dict(l=40, r=20, t=40, b=40),
                      template="plotly_white", height=480)
    return fig


def _aggregate(df, x, y, color, agg):
    group_cols = [c for c in [x, color] if c]
    if agg == "count" or not y:
        g = df.groupby(group_cols, dropna=False).size().reset_index(name="count")
        return g, "count"
    if agg == "none":
        return df, y
    g = df.groupby(group_cols, dropna=False)[y].agg(agg).reset_index()
    return g, y


def _make_fig(df, chart, x, y, color, agg):
    seq = BRAND_SEQUENCE
    if chart == "Histogram":
        return px.histogram(df, x=x, color=color, color_discrete_sequence=seq)
    if chart == "Box":
        return px.box(df, x=x, y=y, color=color, color_discrete_sequence=seq)
    if chart == "Scatter":
        return px.scatter(df, x=x, y=y, color=color, color_discrete_sequence=seq)
    if chart == "Pie":
        g, measure = _aggregate(df, x, y, None, agg)
        return px.pie(g, names=x, values=measure, color_discrete_sequence=seq)

    g, measure = _aggregate(df, x, y, color, agg)
    if chart == "Line":
        g = g.sort_values(x)
        return px.line(g, x=x, y=measure, color=color, markers=True,
                       color_discrete_sequence=seq)
    # Default: Bar
    return px.bar(g, x=x, y=measure, color=color, barmode="group",
                  color_discrete_sequence=seq)


def _empty_fig(text):
    fig = px.scatter(x=[0], y=[0])
    fig.update_traces(opacity=0)
    fig.update_layout(template="plotly_white",
                      annotations=[dict(text=text, showarrow=False,
                                        font=dict(size=16, color="#6b7280"))],
                      xaxis=dict(visible=False), yaxis=dict(visible=False),
                      height=480, margin=dict(l=40, r=20, t=40, b=40))
    return fig


# ---------------------------------------------------------------------------
# Inline CSS (served from /assets is also supported; kept here for single-file)
# ---------------------------------------------------------------------------
app.index_string = """
<!DOCTYPE html>
<html>
<head>
  {%metas%}<title>{%title%}</title>{%favicon%}{%css%}
  <style>
    :root{--bg:#ffffff;--card:#ffffff;--panel:#d9d9d9;--bd:#d9d9d9;
          --accent:#f8511f;--accent-dk:#c23a12;--ink:#111111;--mut:#6b6b6b;}
    *{box-sizing:border-box;}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
    .wrap{max-width:1200px;margin:0 auto;padding:24px;}
    .topbar{display:flex;align-items:center;gap:14px;margin-bottom:18px;
            border-bottom:3px solid var(--accent);padding-bottom:12px;}
    .brand{font-size:22px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;}
    .tag{color:var(--mut);font-size:14px;}
    .upload{border:2px dashed #bdbdbd;border-radius:10px;padding:28px;text-align:center;
            color:var(--mut);background:#fafafa;cursor:pointer;transition:.15s;}
    .upload:hover{border-color:var(--accent);color:var(--accent-dk);}
    .upload a{color:var(--accent);font-weight:700;}
    .msg{margin:10px 2px;font-size:14px;min-height:18px;}
    .ok{color:var(--accent-dk);} .err{color:#b91c1c;}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:18px 0;}
    .kpi{background:#f5f5f5;border:1px solid var(--bd);border-top:3px solid var(--accent);
         border-radius:8px;padding:16px;}
    .kpi-title{color:var(--mut);font-size:13px;text-transform:uppercase;letter-spacing:.4px;}
    .kpi-value{font-size:24px;font-weight:800;margin-top:4px;color:var(--ink);}
    .kpi-sub{color:var(--mut);font-size:12px;margin-top:2px;}
    .panel{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:18px;margin:16px 0;}
    .controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:14px;}
    .control label{display:block;font-size:13px;font-weight:700;margin-bottom:4px;}
    .foot{color:var(--mut);font-size:13px;text-align:center;margin-top:24px;}
    .ptable{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px;}
    .ptable th,.ptable td{border:1px solid var(--bd);padding:6px 10px;text-align:left;}
    .ptable th{background:var(--panel);}
    summary{cursor:pointer;font-weight:700;}
    /* Floating AI assistant */
    .ai-fab{position:fixed;bottom:24px;right:24px;z-index:1000;
            background:var(--accent);color:#fff;border:none;border-radius:30px;
            padding:14px 22px;font-size:15px;font-weight:800;cursor:pointer;
            box-shadow:0 6px 18px rgba(248,81,31,.4);transition:.15s;}
    .ai-fab:hover{background:var(--accent-dk);transform:translateY(-1px);}
    .ai-fab::before{content:"✦ ";}
    .ai-box{position:fixed;bottom:88px;right:24px;z-index:1000;width:360px;max-width:calc(100vw - 48px);
            background:#fff;border:1px solid var(--bd);border-radius:14px;
            box-shadow:0 12px 40px rgba(0,0,0,.18);padding:16px;
            display:flex;flex-direction:column;}
    .ai-box.ai-hidden{display:none;}
    .ai-box-head{display:flex;justify-content:space-between;align-items:flex-start;
                 border-bottom:2px solid var(--accent);padding-bottom:10px;margin-bottom:12px;}
    .ai-title{font-size:15px;font-weight:800;}
    .ai-badge{font-size:10px;font-weight:700;color:var(--accent-dk);
              text-transform:uppercase;letter-spacing:.4px;margin-top:3px;}
    .ai-close{background:none;border:none;font-size:22px;line-height:1;color:var(--mut);cursor:pointer;}
    .ai-close:hover{color:var(--ink);}
    .ai-answer{font-size:14px;line-height:1.55;min-height:40px;max-height:300px;overflow:auto;
               color:var(--ink);margin-bottom:12px;}
    .ai-answer:empty::before{content:"Ask anything about the data you've uploaded.";color:var(--mut);}
    .ai-row{display:flex;gap:8px;}
    .ai-input{flex:1;padding:10px 12px;border:1px solid #bdbdbd;border-radius:8px;font-size:14px;}
    .ai-input:focus{outline:none;border-color:var(--accent);}
    .ai-send{padding:10px 16px;border:none;border-radius:8px;background:var(--accent);
             color:#fff;font-size:14px;font-weight:700;cursor:pointer;}
    .ai-send:hover{background:var(--accent-dk);}
  </style>
</head>
<body>{%app_entry%}<footer>{%config%}{%scripts%}{%renderer%}</footer></body>
</html>
"""

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8050, debug=False)
