# Model Mapping — Niu-Mission-Control Adapters

**DOX Rule:** Jangan pakai combo/generic model sebagai mapping utama thread/DM. Sumber mapping sah: hasil auto-discovery (probe HTTP-200) → fallback chain harus lolos probe sebelum dicatat.

## Adapters

| Adapter | Type | Path / URL | Probe | Status | Fallback Order |
|---|---|---|---|---|---|
| **MockAdapter** | mock | `lib/server/adapters/mock.ts` | N/A (always available) | 🟢 Active | 3 (last resort) |
| **HermesCLIAdapter** | hermes | `HERMES_PATH` env atau `~/.hermes/` atau `hermes-agent/hermes_cli/` | `hermes --version` execFile shell=false | 🟢 Active | 2 |
| **HermesGatewayAdapter** | hermes | `HERMES_GATEWAY_URL` env (e.g. http://localhost:8080) | `GET /health` HTTP-200 | ⚪ Future | 1 (first try) |

## Fallback Chain

```
1. HermesGatewayAdapter (if HERMES_GATEWAY_URL set && probe HTTP-200)
   ↓ fail
2. HermesCLIAdapter (if HERMES_PATH exists && hermes --version ok)
   ↓ fail
3. MockAdapter (always, random delay 2-8s, 85% success, 10% approval, random token_usage)
```

## Registry API

`lib/server/adapters/index.ts`:
- `getAdapter(agentId: string): AgentAdapter`
- `listAdapters(): string[]`
- `registerAdapter(name: string, adapter: AgentAdapter)`

## Agent Default Mapping

| Agent | Key | Adapter | Model Default | Role |
|---|---|---|---|---|
| Hermes Chief | chief | hermes (gateway→cli→mock) | claude-4-sonnet | Orchestrator & Leader |
| Research | research | mock | gpt-4o-mini | Research & Learn |
| Programmer | programmer | mock | claude-3.5-sonnet | Programmer & Coder |
| QA Tester | qa | mock | gpt-4o-mini | Tester & QA |
| Kreator | creator | hermes | claude-3.5-sonnet | Content Creator |

## Auto-Discovery (Future)

Script `scripts/model-discovery.mjs`:
- Probe `HERMES_GATEWAY_URL` → GET /health
- Probe `HERMES_PATH` → execFile `hermes --version`
- Probe `OLLAMA_HOST` → GET /api/tags
- Write result to `docs/registry/model-mapping.json` + update this MD

## Security

- `execFile` shell=false (jangan `exec` atau `execSync`)
- Allowlist command: hanya `hermes` binary yang diizinkan, path validated
- Timeout 30s per dispatch, kill jika hang
