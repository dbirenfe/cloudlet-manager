from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.auth import get_current_user
from app.models import (
    BranchList,
    BranchUpdateRequest,
    BranchUpdateResponse,
    ValuesUpdateRequest,
    ValuesFileList,
    UpdateResponse,
    RepoStructure,
    ScopeApps,
)
from app.spec_service import get_structure, get_apps_for_scope, update_app_branch, update_app_values
from app.github_client import list_branches, list_values_files


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if not s.github_token:
        print("WARNING: CLOUDLET_GITHUB_TOKEN not set. GitHub API calls will fail.")
    yield


app = FastAPI(
    title="Cloudlet Manager",
    description="GitOps branch management dashboard for ArgoCD-managed clusters",
    version="1.0.0",
    lifespan=lifespan,
)

s = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=s.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/structure", response_model=RepoStructure)
async def structure(user: dict = Depends(get_current_user)):
    """Get the full repo structure: flavors, environments, and clusters."""
    return await get_structure()


@app.get("/api/apps", response_model=ScopeApps)
async def apps(
    flavor: str | None = Query(None),
    env: str | None = Query(None),
    cluster: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    """
    Get resolved app configs for a scope.
    Override chain: root -> flavor -> env -> cluster.
    """
    return await get_apps_for_scope(flavor, env, cluster)


@app.get("/api/branches", response_model=BranchList)
async def branches(
    repo_url: str = Query(..., description="Full GitHub repo URL"),
    user: dict = Depends(get_current_user),
):
    """List all branches for a given app repo URL."""
    branch_list = await list_branches(repo_url)
    return BranchList(repo_url=repo_url, branches=branch_list)


@app.post("/api/update-branch", response_model=BranchUpdateResponse)
async def update_branch(
    req: BranchUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Update the targetRevision for an app in a specific YAML file."""
    try:
        result = await update_app_branch(req.file_path, req.app_name, req.new_branch)
        commit_url = result.get("commit", {}).get("html_url", "")
        username = user.get("preferred_username", "unknown")
        return BranchUpdateResponse(
            success=True,
            message=f"Branch updated by {username}",
            commit_url=commit_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update: {e}")


@app.get("/api/values-files", response_model=ValuesFileList)
async def values_files(
    repo_url: str = Query(..., description="Full GitHub repo URL"),
    branch: str = Query("main", description="Branch to list files from"),
    user: dict = Depends(get_current_user),
):
    """List YAML files in a repo that can be used as Helm values files."""
    files = await list_values_files(repo_url, branch)
    return ValuesFileList(repo_url=repo_url, branch=branch, files=files)


@app.post("/api/update-values", response_model=UpdateResponse)
async def update_values(
    req: ValuesUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Update the helm.valuesFiles for an app in a specific YAML file."""
    try:
        result = await update_app_values(req.file_path, req.app_name, req.values_files)
        commit_url = result.get("commit", {}).get("html_url", "")
        username = user.get("preferred_username", "unknown")
        return UpdateResponse(
            success=True,
            message=f"Values files updated by {username}",
            commit_url=commit_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update: {e}")


@app.get("/api/auth/config")
async def auth_config():
    """Return Keycloak OIDC config for the frontend."""
    s = get_settings()
    if not s.keycloak_url:
        return {"enabled": False}
    return {
        "enabled": True,
        "url": s.keycloak_url,
        "realm": s.keycloak_realm,
        "clientId": s.keycloak_client_id,
    }
