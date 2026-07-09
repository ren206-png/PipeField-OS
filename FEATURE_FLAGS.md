# FEATURE_FLAGS.md
# PipeField OS — Feature Flag Registry

Every behavioral flag is documented here. All flags default to **OFF** unless noted.
With all flags at their defaults, the platform behaves identically to the pre-Phase-1 state.

Flag evaluation occurs at **request time** (process.env read on every invocation) — no build-time baking. Changing a flag in Vercel Environment Variables takes effect on the next request after deployment.

---

## Flag Reference

### `PFOS_INTELLIGENCE_ENGINE_ENABLED`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 1 |
| **Module** | `src/intelligence/registry.ts` |

**What it does:** Master switch for the Intelligence Engine. When OFF, all calls to `intelligence.invoke()` return `{ ok: false, reason: 'engine_disabled' }` immediately without touching OpenAI or any database. When ON, capability invocations flow through the registry with tier gating and audit logging.

**Rollback:** Set `PFOS_INTELLIGENCE_ENGINE_ENABLED=false` (or delete the env var) in Vercel → redeploy. All existing `/api/knowledge/ask` and `/api/knowledge/process/[id]` routes continue to function independently — they are not affected by this flag.

**Dependencies:** Must be ON before any other intelligence flag has effect.

---

### `PFOS_INTELLIGENCE_COST_CONTROLS`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/accounting.ts` |

**What it does:** Enforces per-organization daily token ceilings (defined in `accounting.ts`). When a ceiling is reached, the registry returns `{ ok: false, reason: 'budget_exceeded' }` with a clear user-facing message instead of calling OpenAI. Resets at midnight UTC.

**Rollback:** Set `PFOS_INTELLIGENCE_COST_CONTROLS=false`. No data loss — `ai_invocations` rows are retained for analytics.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_KNOWLEDGE_RETRY_QUEUE`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 3 |
| **Module** | `src/app/api/cron/retry-embeddings/route.ts` (not yet created) |

**What it does:** Enables a Vercel Cron job that re-processes `knowledge_sources` rows where `processing_status = 'failed'`. Closes the P0 risk that failed embeddings are silently lost.

**Rollback:** Set `PFOS_KNOWLEDGE_RETRY_QUEUE=false` and remove the cron entry from `vercel.json`.

**Dependencies:** None. Can be enabled independently of the Intelligence Engine.

---

### `PFOS_INTELLIGENCE_WELDING_GUIDANCE`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/welding-guidance.ts` |

**What it does:** Activates the Welding Guidance capability. Surfaces relevant WPS and procedure documents inline on the weld creation form. The user sees an AI hint — they must still confirm all entries.

**Rollback:** Set `PFOS_INTELLIGENCE_WELDING_GUIDANCE=false`. No schema changes to roll back.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_SAFETY_ANALYSIS`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/safety-analysis.ts` |

**What it does:** Activates safety document RAG analysis. Available to all tiers. Surfaces on DFR form and project safety panels.

**Rollback:** Set `PFOS_INTELLIGENCE_SAFETY_ANALYSIS=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_QA_QC_ASSISTANCE`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/qa-qc-assistance.ts` |

**What it does:** Activates NCR drafting and ITP guidance assistance. Starter+ tiers.

**Rollback:** Set `PFOS_INTELLIGENCE_QA_QC_ASSISTANCE=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_PIPEFITTER_ASSISTANT`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/pipefitter-assistant.ts` |

**What it does:** Field-worker optimised RAG assistant. Plain-language answers from knowledge base. Starter+.

**Rollback:** Set `PFOS_INTELLIGENCE_PIPEFITTER_ASSISTANT=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_MATERIAL_TAKEOFF`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/material-takeoff.ts` |

**What it does:** AI-generated material takeoff lists from spool data. Starter+.

**Rollback:** Set `PFOS_INTELLIGENCE_MATERIAL_TAKEOFF=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_INSPECTION`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/inspection.ts` |

**What it does:** ITP hold/witness point guidance and acceptance criteria interpretation. Starter+.

**Rollback:** Set `PFOS_INTELLIGENCE_INSPECTION=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_FABRICATION_PLANNING`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/fabrication-planning.ts` |

**What it does:** Spool fabrication sequence recommendations. Professional+ only.

**Rollback:** Set `PFOS_INTELLIGENCE_FABRICATION_PLANNING=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_ESTIMATING`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/estimating.ts` |

**What it does:** Effort estimation from project scope and productivity rates. Professional+.

**Rollback:** Set `PFOS_INTELLIGENCE_ESTIMATING=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_SCHEDULING`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/scheduling.ts` |

**What it does:** Schedule health analysis and recovery action recommendations. Professional+.

**Rollback:** Set `PFOS_INTELLIGENCE_SCHEDULING=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_DRAWING_ANALYSIS`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/drawing-analysis.ts` |

**What it does:** Vision-based analysis of isometrics, P&IDs, and GA drawings using GPT-4o. Professional+. Note: uses the more expensive `gpt-4o` model — monitor token costs.

**Rollback:** Set `PFOS_INTELLIGENCE_DRAWING_ANALYSIS=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_INTELLIGENCE_DIGITAL_TWIN`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 2 |
| **Module** | `src/intelligence/adapters/digital-twin.ts` |

**What it does:** Operational status twin — answers natural language questions about system readiness from live project data. Enterprise only.

**Rollback:** Set `PFOS_INTELLIGENCE_DIGITAL_TWIN=false`.

**Dependencies:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` must be ON.

---

### `PFOS_AUTOMATION_PREFILL`
| Attribute | Value |
|---|---|
| **Default** | `false` (OFF) |
| **Phase** | Phase 5 |
| **Module** | NCR + DFR form components (not yet modified) |

**What it does:** Enables auto-prefill of NCR forms from the linked weld record and Daily Field Report forms from the active project + crew roster. The user must confirm before submitting. No data is ever silently committed.

**Rollback:** Set `PFOS_AUTOMATION_PREFILL=false`. Forms revert to their current empty-state behavior.

**Dependencies:** None (no AI calls; uses existing data).

---

### `PFOS_BILLING_WELDER_LIMIT`
| Attribute | Value |
|---|---|
| **Default** | `true` (ON) |
| **Phase** | P0-FIX-2 |
| **Module** | `src/app/api/welders/route.ts` |

**What it does:** Enforces the plan-seat limit on welder creation via `checkWelderLimit()`. This flag defaults **ON** because it closes an active production gap (welder limits were previously unenforced). Set to `false` only during an emergency rollback.

**Rollback:** Set `PFOS_BILLING_WELDER_LIMIT=false`. The new `POST /api/welders` route will skip the limit check. Note: the `useCreateWelder` hook still calls the API route — it does not revert to direct Supabase. A full rollback requires reverting `src/hooks/useWelders.ts` to the pre-Phase-1 version.

**Dependencies:** Requires `POST /api/welders/route.ts` to be deployed (Phase 1).

---

## How to add a new flag

1. Add the env var to `.env.local.example` and `.env.production.example`.
2. Add it to the `FLAGS` object in `src/intelligence/flags.ts`.
3. Document it in this file with: default, phase, module, what it does, rollback, dependencies.
4. Never use the flag in client-side code — flags are evaluated server-side only.
