# ADR-004: Adapt APEX-UI as the Mission Core Visual Layer

- **Status:** Accepted
- **Date:** 2026-08-21
- **Source:** [RubenM1990/APEX-UI](https://github.com/RubenM1990/APEX-UI) at `f9fd176833a39b4634bad23cdc898fac4e0ab6a2`

## Context

APEX-UI provides a polished autonomous-agent orb, SVG reasoning graph, state-driven animation, and agent detail interaction. Niu-MissionControl already has a FastAPI backend, a vanilla frontend, a Three.js ORB, five real agents, floating application windows, and a zero-build frontend decision in ADR-001.

Importing APEX-UI as a Next.js application would add a second runtime and duplicate routing, state, WebSocket, deployment, and accessibility logic. Copying its 18-agent business roster would also misrepresent Niumination's actual ecosystem.

`niumination/ecosystem-config` was used as read-only architecture context. No file in that repository is changed by this adoption.

## Decision

Adapt APEX-UI's visual and interaction language into the existing zero-build frontend instead of importing its Next.js stack.

### Adopted

- gold concentric ring around a cyan particle core;
- SVG reasoning constellation and animated path motes;
- state model (`standby`, `processing`, `degraded`);
- interactive agent nodes and an accessible detail dialog;
- equalizer/status cluster;
- `prefers-reduced-motion` behavior;
- decorative WebGL failure containment.

### Niumination-specific changes

- roster is the real fleet: Chief, Research, Programmer, QA, and Creator;
- status, model, role, and task counters come from `/api/mc/agents`;
- live updates come from the canonical `/ws/swarm` endpoint;
- busy agents energize their path and move the core to `PROCESSING`;
- an agent dialog opens the existing Swarm floating window;
- existing Mission Control panels, menu, routines, gesture control, and floating-window shell remain intact;
- implementation is plain HTML/CSS/JavaScript and the existing Three.js CDN, with no Node build step.

## File boundaries

- `dashboard/orb.html`: semantic shell and progressive fallback markup.
- `dashboard/apex-adaptation.css`: adapted design tokens, state visuals, responsive and reduced-motion rules.
- `dashboard/reasoning-web.js`: five-agent SVG graph, motes, state updates, and accessible dialog.
- `dashboard/orb.js`: Three.js core, REST/WS telemetry, routines, and gesture integration.
- `frontend/`: synchronized copy during the v2→v3 transition.
- `THIRD_PARTY_NOTICES.md`: upstream attribution and MIT notice.

## Consequences

### Positive

- no new runtime dependencies or build pipeline;
- visual design is grounded in live Mission Control data rather than demo state;
- current FastAPI deployment and floating-window architecture are preserved;
- attribution and upstream license obligations are explicit;
- WebGL remains decorative, so data and controls survive graphics failure.

### Trade-offs

- the vanilla implementation cannot consume APEX-UI component updates automatically;
- `dashboard/` and `frontend/` remain duplicated until the planned v3 cutover completes;
- Three.js and MediaPipe are still CDN dependencies inherited from the current ORB architecture.
