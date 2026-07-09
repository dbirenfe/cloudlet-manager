# Cloudlet Manager - Helm Chart

GitOps branch management dashboard for ArgoCD-managed clusters.  
Lets users browse clusters by flavor/env, see which apps use which branches, swap branches via dropdown, and get warnings for deleted branches — all committed back to the spec repo.

---

## Architecture

```
                  ┌──────────────────────────────────────────┐
                  │            Frontend Pod                   │
   Route ────►   │  oauth2-proxy (:4180)  ──►  nginx (:8080)│
   (TLS edge)    │  (OIDC login via RHBK)     (React SPA +  │
                  │                            /api/ proxy)   │
                  └───────────────────────────┬───────────────┘
                                              │ /api/*
                                              ▼
                                ┌─────────────────────────┐
                                │     Backend Pod          │
                                │  FastAPI (:8000)         │
                                │  - reads spec repo       │
                                │  - validates OIDC tokens │
                                │  - commits changes       │
                                └─────────────────────────┘
```

**Traffic flow:** User → Route → OAuth2 Proxy (authenticates via RHBK) → Nginx (serves UI, proxies API) → FastAPI backend.  
The backend also validates the OIDC token and checks group membership.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **OpenShift** | 4.12+ with `oc` CLI access |
| **Helm** | v3.x |
| **ExternalSecrets Operator** | Installed on the cluster with a configured `SecretStore` or `ClusterSecretStore` pointing to HashiCorp Vault |
| **HashiCorp Vault** | With secrets pre-populated (see [Vault Setup](#vault-setup)) |
| **RHBK (Keycloak)** | An instance with a client configured (see [RHBK Setup](#rhbk-setup)) |
| **Internal Git** | A Git server (Gitea/GitLab/GitHub Enterprise) hosting the `cloudlets-spec` repo |
| **Internal Registry** | Container images mirrored (see [Image Mirroring](#image-mirroring)) |

---

## Image Mirroring (Air-Gapped)

Three container images need to be available in your internal registry:

| Image | Source | Description |
|---|---|---|
| `cloudlet-manager/backend` | Built from `backend/Dockerfile` | FastAPI API server |
| `cloudlet-manager/frontend` | Built from `frontend/Dockerfile` | Nginx + React SPA |
| `oauth2-proxy/oauth2-proxy` | `quay.io/oauth2-proxy/oauth2-proxy:v7.7.1` | OIDC authentication proxy |

### Building and pushing images

```bash
# On a machine with internet access:

# Backend
cd backend/
podman build -t registry.internal.example.com/cloudlet-manager/backend:1.0.0 .
podman push registry.internal.example.com/cloudlet-manager/backend:1.0.0

# Frontend
cd frontend/
podman build -t registry.internal.example.com/cloudlet-manager/frontend:1.0.0 .
podman push registry.internal.example.com/cloudlet-manager/frontend:1.0.0

# OAuth2 Proxy (pull from upstream, retag, push)
podman pull quay.io/oauth2-proxy/oauth2-proxy:v7.7.1
podman tag quay.io/oauth2-proxy/oauth2-proxy:v7.7.1 \
  registry.internal.example.com/oauth2-proxy/oauth2-proxy:v7.7.1
podman push registry.internal.example.com/oauth2-proxy/oauth2-proxy:v7.7.1
```

### Offline transfer (no registry push access)

```bash
# Save to tar on connected machine
podman save -o cloudlet-backend.tar registry.internal.example.com/cloudlet-manager/backend:1.0.0
podman save -o cloudlet-frontend.tar registry.internal.example.com/cloudlet-manager/frontend:1.0.0
podman save -o oauth2-proxy.tar registry.internal.example.com/oauth2-proxy/oauth2-proxy:v7.7.1

# Transfer tars to air-gapped machine, then load
podman load -i cloudlet-backend.tar
podman load -i cloudlet-frontend.tar
podman load -i oauth2-proxy.tar

# Push to internal registry
podman push registry.internal.example.com/cloudlet-manager/backend:1.0.0
podman push registry.internal.example.com/cloudlet-manager/frontend:1.0.0
podman push registry.internal.example.com/oauth2-proxy/oauth2-proxy:v7.7.1
```

---

## Vault Setup

The chart uses **ExternalSecrets Operator** to pull sensitive data from HashiCorp Vault. You need to create three secrets in Vault:

### 1. Git Token

Path: `secret/data/cloudlet-manager/git`

```bash
vault kv put secret/cloudlet-manager/git \
  token="<your-git-personal-access-token>"
```

The token needs read/write access to the `cloudlets-spec` repository.

### 2. SSO Client Secret

Path: `secret/data/cloudlet-manager/sso`

```bash
vault kv put secret/cloudlet-manager/sso \
  client-secret="<keycloak-client-secret>"
```

This is the client secret from your RHBK client (see [RHBK Setup](#rhbk-setup)).

### 3. OAuth2 Proxy Cookie Secret

Path: `secret/data/cloudlet-manager/oauth-proxy`

```bash
# Generate a random cookie secret
COOKIE_SECRET=$(python3 -c "import os,base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")

vault kv put secret/cloudlet-manager/oauth-proxy \
  cookie-secret="$COOKIE_SECRET"
```

### SecretStore / ClusterSecretStore

Ensure you have a `SecretStore` or `ClusterSecretStore` resource configured in your cluster that points to your Vault instance. Example:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.internal.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "external-secrets"
          serviceAccountRef:
            name: "external-secrets"
            namespace: "external-secrets"
```

Update `vault.secretStoreName` and `vault.secretStoreKind` in your `values.yaml` to match.

---

## RHBK Setup

Create a client in your RHBK (Red Hat Build of Keycloak) instance:

### 1. Create Client

| Setting | Value |
|---|---|
| **Client ID** | `cloudlet-manager` |
| **Client Protocol** | `openid-connect` |
| **Access Type** | `confidential` |
| **Standard Flow Enabled** | `ON` |
| **Valid Redirect URIs** | `https://<route-host>/oauth2/callback` |
| **Web Origins** | `https://<route-host>` |

### 2. Configure Client Scopes

Ensure the `groups` claim is included in the token:

1. Go to **Client Scopes** → Create a new scope called `groups`
2. Add a **mapper**:
   - **Mapper Type:** Group Membership
   - **Name:** groups
   - **Token Claim Name:** groups
   - **Full group path:** ON
   - **Add to ID token:** ON
   - **Add to access token:** ON
3. Add this scope as a **Default Client Scope** on the `cloudlet-manager` client

### 3. Create Groups and Assign Users

1. Create the group(s) listed in `sso.allowedGroups` (e.g., `/cloudlet-admins`)
2. Assign users to these groups
3. Only users in these groups will be able to access the application

### 4. Copy Client Secret

Go to the client's **Credentials** tab, copy the secret, and store it in Vault (see [Vault Setup](#vault-setup)).

---

## Configuration Reference

### `values.yaml` — All Fields

| Parameter | Description | Required | Default |
|---|---|---|---|
| `namespace` | Kubernetes namespace to deploy into | Yes | `cloudlet-manager` |
| **Backend** | | | |
| `backend.image.repository` | Internal registry path for the backend image | Yes | `""` |
| `backend.image.tag` | Image tag | No | `latest` |
| `backend.replicas` | Number of backend replicas | No | `1` |
| `backend.resources` | CPU/memory requests and limits | No | 100m/128Mi - 500m/256Mi |
| **Frontend** | | | |
| `frontend.image.repository` | Internal registry path for the frontend image | Yes | `""` |
| `frontend.image.tag` | Image tag | No | `latest` |
| `frontend.replicas` | Number of frontend replicas | No | `1` |
| `frontend.resources` | CPU/memory requests and limits | No | 50m/64Mi - 200m/128Mi |
| **OAuth2 Proxy** | | | |
| `oauthProxy.image.repository` | Internal registry path for the oauth2-proxy image | Yes (if SSO) | `""` |
| `oauthProxy.image.tag` | Image tag | No | `latest` |
| `oauthProxy.resources` | CPU/memory requests and limits | No | 50m/32Mi - 200m/64Mi |
| **Git** | | | |
| `git.specRepo` | Spec repo in `owner/repo` format | Yes | `""` |
| `git.specBranch` | Branch to read/write | No | `main` |
| `git.apiUrl` | Git server API URL | Yes | `""` |
| **SSO** | | | |
| `sso.enabled` | Enable OIDC authentication | No | `true` |
| `sso.keycloakUrl` | RHBK base URL (no trailing slash) | Yes (if SSO) | `""` |
| `sso.realm` | Keycloak realm name | Yes (if SSO) | `""` |
| `sso.clientId` | OIDC client ID | Yes (if SSO) | `""` |
| `sso.allowedGroups` | List of groups allowed to access the app | No | `["/cloudlet-admins"]` |
| **Route** | | | |
| `route.host` | Hostname for the OpenShift Route | Yes | `""` |
| `route.tls.termination` | TLS termination type | No | `edge` |
| `route.tls.insecureEdgeTerminationPolicy` | Insecure traffic policy | No | `Redirect` |
| **Misc** | | | |
| `imagePullSecret` | Name of image pull secret for the registry | No | `""` |
| `corsOrigins` | Allowed CORS origins (JSON array string) | No | `["*"]` |
| `branchCacheTtl` | Branch list cache duration in seconds | No | `300` |
| **Vault** | | | |
| `vault.secretStoreName` | Name of your SecretStore/ClusterSecretStore | Yes | `vault-backend` |
| `vault.secretStoreKind` | `SecretStore` or `ClusterSecretStore` | No | `ClusterSecretStore` |
| `vault.refreshInterval` | How often to sync secrets from Vault | No | `1h` |
| `vault.paths.gitToken` | Vault path for the Git PAT | Yes | `secret/data/cloudlet-manager/git` |
| `vault.paths.ssoClientSecret` | Vault path for the RHBK client secret | Yes (if SSO) | `secret/data/cloudlet-manager/sso` |
| `vault.paths.oauthCookieSecret` | Vault path for the OAuth2 Proxy cookie secret | Yes (if SSO) | `secret/data/cloudlet-manager/oauth-proxy` |

---

## Installation

### 1. Create namespace

```bash
oc new-project cloudlet-manager
```

### 2. Create your values file

```bash
cp values.yaml my-values.yaml
# Edit my-values.yaml with your environment's settings
```

### 3. Install

```bash
helm install cloudlet-manager ./chart -f my-values.yaml -n cloudlet-manager
```

### 4. Verify

```bash
# Check ExternalSecrets synced
oc get externalsecrets -n cloudlet-manager

# Check pods are running
oc get pods -n cloudlet-manager

# Check the route
oc get route cloudlet-manager -n cloudlet-manager
```

---

## Upgrading

```bash
helm upgrade cloudlet-manager ./chart -f my-values.yaml -n cloudlet-manager
```

---

## Uninstalling

```bash
helm uninstall cloudlet-manager -n cloudlet-manager
```

---

## Disabling SSO (Development / Testing)

Set `sso.enabled: false` in your values file. This will:
- Remove the OAuth2 Proxy sidecar (no login required)
- Remove the SSO ExternalSecrets
- Route traffic directly to nginx
- Backend will accept all requests without token validation

---

## Troubleshooting

### ExternalSecrets not syncing

```bash
oc get externalsecrets -n cloudlet-manager
oc describe externalsecret cloudlet-git-token -n cloudlet-manager
```

Check that:
- The `SecretStore`/`ClusterSecretStore` exists and is healthy
- Vault paths are correct and accessible
- The Vault keys match (`token`, `client-secret`, `cookie-secret`)

### OAuth2 Proxy redirect loop

- Ensure the redirect URI in RHBK matches: `https://<route-host>/oauth2/callback`
- Ensure the cookie secret is a valid base64-encoded 32-byte value
- Check oauth2-proxy logs: `oc logs -c oauth2-proxy deploy/cloudlet-frontend -n cloudlet-manager`

### Backend 401/403 errors

- Check that the RHBK client has the `groups` mapper configured
- Verify the user is in one of the `sso.allowedGroups`
- Check backend logs: `oc logs deploy/cloudlet-backend -n cloudlet-manager`

### Images not pulling

- Verify `imagePullSecret` is set if your registry requires auth
- Verify image paths in values match your internal registry
- Check: `oc describe pod <pod-name> -n cloudlet-manager`
