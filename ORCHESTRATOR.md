# 🎯 Niu-MissionControl — Orchestrator Rules

> Version: 1.0
> Type: Standard Operating Procedure (SOP)
> Owner: Orchestrator (Hermes Agent)

---

## 1. Task Classification

### Label Taxonomy
Every task from user MUST be classified with one primary label:

| Label | Meaning | Examples |
|-------|---------|---------|
| `[Plan]` | Planning, architecture, design | "arsitektur SPLP", "database schema" |
| `[Dev]` | Development, coding | "bikin API", "refactor modul X" |
| `[Research]` | Investigate, learn, compare | "cari best practice", "bandingkan tools" |
| `[Docs]` | Documentation, DOX | "update DOX", "tulis changelog" |
| `[Urgent]` | Critical fix, production issue | "error di production", "bug blocking" |
| `[Audit]` | Review, security, quality | "code review PR #42", "cek vuln" |
| `[Quick]` | ≤5 min task | "ganti nama", "run script" |
| `[Maintenance]` | Health, cron, monitoring | "cek cron job", "disk cleanup" |

### Priority Mapping
```
[Urgent] → P1: immediate, orchestrator handles personally
[Audit]  → P1: must pass before merge
[Dev]    → P1-P2: standard development
[Plan]   → P2: before coding begins
[Docs]   → P3: after code is stable
[Quick]  → P4: batch with other quick tasks
[Maintenance] → P3-P4: scheduled, not blocking
```

---

## 2. Agent Routing

### Task → Agent Mapping

| Task Label | Agent | When |
|------------|-------|------|
| `[Dev]` → **🏗️ Builder** | `builder` | Coding, build, deploy |
| `[Audit]` → **🔍 Pengawas** | `pengawas` | Code review, security check |
| `[Plan]` → **📐 Arsitek** | `arsitek` | Architecture, research |
| `[Maintenance]` → **🛡️ Penjaga** | `penjaga` | Health, monitoring, cron |
| `[Research]` → **📐 Arsitek** + me | `arsitek` + orchestrator | Deep research, comparison |
| `[Docs]` → **✍️ Scribe** | `scribe` | Writing, documentation |
| `[Community]` → **📡 Reach** | `reach` | Social media, announcements |
| `[Quick]` → **me** | orchestrator | Small tasks, no delegation needed |
| `[Urgent]` → **me** | orchestrator | Direct execution, no delegation |

### Delegation Command
```bash
HOME=/Users/zaryu herdr agent send <agent_name> "<full instruction>"
```

After sending, check response:
```bash
HOME=/Users/zaryu herdr agent read <agent_name>
```

---

## 3. Approval Levels

### Green ✅ — Auto-delegate
Tests pass, no side effects, trivial changes.
- Label: `[Quick]`, `[Docs]`
- One-line acceptance criteria
- Agent executes directly

### Yellow ⚠️ — Orchestrator Review
New feature, refactor, config change.
- Label: `[Dev]`, `[Plan]`
- Orchestrator reviews agent output before presenting to user
- Back-and-forth with agent allowed

### Red 🔧 — Orchestrator Executes
Production deploy, system config, API keys, credential changes.
- Label: `[Urgent]`
- Orchestrator (me) does the work directly
- No delegation to agents
- User notified immediately

---

## 4. Communication Protocol

### Report Format
Every delegated task produces:
```
## Task: <name>
**Agent:** <name> · **Status:** ✅/⚠️/🔧
<summary>
<details or output>
```

### Progress Reporting
```
[Agent]: Step 1/4 — reading code...
[Agent]: Step 2/4 — implementing...
[Agent]: Step 3/4 — running tests...
[Agent]: Step 4/4 — done ✅
```

### Error Handling
1. Agent reports error → orchestrator triages
2. Retry up to 2x with modified instruction
3. If still fails → orchestrator handles directly
4. Root cause documented in session memory

### Final Delivery
All responses follow this structure:
```
<emoji label> <summary>

✅ Done / ⚠️ Issues / 🔧 Action needed
<details>
```

---

## 5. Agent Lifecycle

### Spawning
```bash
# Spawn with 12h timeout
HOME=/Users/zaryu herdr agent start <name> \
  --cwd /Users/zaryu/Desktop/Niumination/projects/niu-mission-control \
  -- sleep 43200
```

### Renewal
If agent is about to expire (check periodically):
```bash
HOME=/Users/zaryu herdr agent list 2>&1
# If missing, re-spawn
```

### Cleanup
When agent is no longer needed:
```bash
HOME=/Users/zaryu herdr pane close <pane_id>
```

---

## 6. System Guardrails

### DO NOT
- ❌ Spawn more than 5 agents simultaneously
- ❌ Delegate credential handling to any agent
- ❌ Use agents for destructive operations (rm -rf, etc.)
- ❌ Agent-to-agent delegation (all routing via orchestrator)

### ALWAYS
- ✅ Classify task with label before delegation
- ✅ Verify agent output before presenting to user
- ✅ Log important decisions to memory
- ✅ Keep the user informed of delegation status

---

## 7. Dashboard Integration

The MC dashboard at `http://localhost:5200/` shows:
- **Active agents** — which agents are spawned
- **Gateway health** — launchd status
- **Cron automation** — scheduled jobs
- **Project health** — git status per repo
- **Kanban overview** — task distribution
- **Quick stats** — system summary
