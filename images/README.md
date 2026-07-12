# Container Images

Pre-built `linux/amd64` images for air-gapped deployment.

| File | Image | Tag |
|---|---|---|
| `cloudlet-backend-2.0.0.tar` | `cloudlet-manager/backend` | `2.0.0` |
| `cloudlet-frontend-2.0.0.tar` | `cloudlet-manager/frontend` | `2.0.0` |
| `oauth2-proxy-v7.7.1.tar` | `oauth2-proxy/oauth2-proxy` | `v7.7.1` |

## Loading and pushing to your internal registry

```bash
# Load images
podman load -i cloudlet-backend-2.0.0.tar
podman load -i cloudlet-frontend-2.0.0.tar
podman load -i oauth2-proxy-v7.7.1.tar

# Retag for your registry
podman tag quay.io/dbirenfe/cloudlet-backend:2.0.0 registry.internal.example.com/cloudlet-manager/backend:2.0.0
podman tag quay.io/dbirenfe/cloudlet-frontend:2.0.0 registry.internal.example.com/cloudlet-manager/frontend:2.0.0
podman tag quay.io/oauth2-proxy/oauth2-proxy:v7.7.1 registry.internal.example.com/oauth2-proxy/oauth2-proxy:v7.7.1

# Push
podman push registry.internal.example.com/cloudlet-manager/backend:2.0.0
podman push registry.internal.example.com/cloudlet-manager/frontend:2.0.0
podman push registry.internal.example.com/oauth2-proxy/oauth2-proxy:v7.7.1
```
