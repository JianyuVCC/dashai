import sys
import traceback

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    from config import get_settings
    from routers import chart_data, dashboards, datasets, public

    settings = get_settings()

    app = FastAPI(title="Dashboarding Tool API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(datasets.router)
    app.include_router(dashboards.router)
    app.include_router(chart_data.router)
    app.include_router(public.router)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    print("STARTUP OK", flush=True)

except Exception as _e:
    traceback.print_exc()
    print(f"\nSTARTUP FAILED: {_e}", file=sys.stderr, flush=True)
    sys.exit(1)
