/*
 * NIU // MISSION CORE — Agent state mapping (shared).
 *
 * Single source of truth for mapping an agent's raw status string onto the
 * Mission Core's coarse visual language. Used by both:
 *   - dashboard/orb.js       (isAgentBusy → processing equalizer / core state)
 *   - dashboard/reasoning-web.js (statusKind → constellation node colour)
 *
 * The production backend (v2 swarm/worker.py) emits `thinking` and `executing`
 * for agents that are actively working, but the ORB originally only recognised
 * `running`/`processing`/`working`. This module centralises the mapping so both
 * consumers stay in sync and the logic can be unit-tested directly under Node.
 *
 * Works in the browser (attaches to window.NiuAgentState) and under Node
 * (module.exports) so the pytest integration test can shell out to `node`.
 */
(function (global) {
  'use strict';

  // Statuses that mean "the agent is actively doing work".
  var BUSY_STATUSES = ['running', 'processing', 'working', 'thinking', 'executing'];
  // Statuses that mean the agent is unreachable / failed.
  var OFFLINE_STATUSES = ['offline', 'error', 'failed', 'unavailable'];
  // Statuses that mean the agent is up but idle-waiting.
  var ONLINE_STATUSES = ['active', 'online', 'ready'];

  function _statusOf(agent) {
    return String((agent && agent.status) || '').toLowerCase();
  }

  function isAgentBusy(agent) {
    if (!agent) return false;
    if (Number(agent.running) > 0) return true;
    return BUSY_STATUSES.indexOf(_statusOf(agent)) !== -1;
  }

  // Coarse kind used by the reasoning constellation:
  //   'busy' | 'offline' | 'online' | 'idle'
  function statusKind(agent) {
    if (!agent) return 'idle';
    if (Number(agent.running) > 0) return 'busy';
    var raw = _statusOf(agent);
    if (BUSY_STATUSES.indexOf(raw) !== -1) return 'busy';
    if (OFFLINE_STATUSES.indexOf(raw) !== -1) return 'offline';
    if (ONLINE_STATUSES.indexOf(raw) !== -1) return 'online';
    return 'idle';
  }

  var api = {
    BUSY_STATUSES: BUSY_STATUSES,
    OFFLINE_STATUSES: OFFLINE_STATUSES,
    ONLINE_STATUSES: ONLINE_STATUSES,
    isAgentBusy: isAgentBusy,
    statusKind: statusKind,
  };

  // Browser global (loaded before orb.js / reasoning-web.js).
  if (typeof global !== 'undefined' && global) {
    global.NiuAgentState = api;
  }
  // Node export (for pytest shell-out / unit tests).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
