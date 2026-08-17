# ADR-001: Frontend Framework

**Status:** Accepted  
**Date:** 2026-08-17  
**Deciders:** Afrizal Munthe

## Context

MC dashboard saat ini pakai vanilla HTML/CSS/JS dengan `build_unified.py` sebagai generator. Redesign doc merekomendasikan Svelte 5 atau React.

## Decision

**Tetap vanilla HTML/CSS/JS** — tidak pindah ke framework.

## Rationale

1. **Sudah jalan** — 12 floating windows, WebSocket, drag-drop, resize, keyboard nav — semua berfungsi tanpa framework
2. **Solo dev** — learning curve Svelte/React + build pipeline overhead untuk dashboard internal
3. **Zero deps frontend** — tidak ada node_modules, tidak ada build step, deploy = copy file
4. **`build_unified.py` = compiler** — Python script yang menghasilkan index.html (bukan framework, tapi pola yang sama)
5. **Portabel** — jalan di mana saja tanpa Node.js

## Consequences

- Tidak ada component library reusable (tapi dashboard internal, bukan produk)
- State management manual (sudah terbukti dengan Set/Map + render functions)
- Jika nanti butuh: bisa incremental adoption (satu view pakai framework, lainnya tetap)
