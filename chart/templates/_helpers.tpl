{{- define "cloudlet-manager.name" -}}
cloudlet-manager
{{- end -}}

{{- define "cloudlet-manager.namespace" -}}
{{ .Values.namespace | default "cloudlet-manager" }}
{{- end -}}

{{- define "cloudlet-manager.labels" -}}
app.kubernetes.io/name: {{ include "cloudlet-manager.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: cloudlet-manager
{{- end -}}

{{- define "cloudlet-manager.backendLabels" -}}
{{ include "cloudlet-manager.labels" . }}
app.kubernetes.io/component: backend
app: cloudlet-backend
{{- end -}}

{{- define "cloudlet-manager.frontendLabels" -}}
{{ include "cloudlet-manager.labels" . }}
app.kubernetes.io/component: frontend
app: cloudlet-frontend
{{- end -}}

{{- define "cloudlet-manager.selectorBackend" -}}
app: cloudlet-backend
{{- end -}}

{{- define "cloudlet-manager.selectorFrontend" -}}
app: cloudlet-frontend
{{- end -}}
