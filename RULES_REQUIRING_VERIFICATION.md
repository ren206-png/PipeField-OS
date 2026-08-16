# Rules Requiring Verification

**Phase:** 1 (Architecture Plan)
**Date:** 2026-08-15

These rules require sign-off from a licensed piping engineer or code authority before the corresponding feature flag is enabled in production. Each rule is gated behind a feature flag so it can be deployed but not activated until verified.

---

| ID | Rule | Standard Reference | Flag Gated Behind |
|----|------|--------------------|-------------------|
| RULE-001 | Position coverage expansion table — 6G covers all positions | ASME IX QW-461.9 | `qualificationEnforcement` |
| RULE-002 | P-number grouping — which base metals are grouped for qualification | ASME IX QW-422 | `qualificationEnforcement` |
| RULE-003 | Thickness range: max qualified = 2× coupon thickness (with exceptions) | ASME IX QW-451 | `qualificationEnforcement` |
| RULE-004 | NDE percentage tables for B31.3 Normal / Category D / High-pressure service | ASME B31.3 Table 341.3.2 and 341.4.1 | `ndeEnabled` |
| RULE-005 | Continuity window = 180 calendar days per QW-322.1(a) | ASME IX QW-322 | `continuityEnforcement` |

---

_Rules will be added here as Phase 2 implementation produces new logic requiring engineering verification._
