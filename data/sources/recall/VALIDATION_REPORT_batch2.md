# Validation report — batch 2

Tables: SW fittings (B16.11), bolt drill/tap (UNC/UNF/metric/NPT), NPT threads (B1.20.1), flange weights, flange hub dims, reducing-tee outlets.

Checks: socket bore > pipe OD; 6000 walls thicker / bores smaller / A longer than 3000; 45 A < 90 A; monotonic by size; tap drill < nominal; clearance > nominal; metric drill ≈ D−P; NPT L2 > L1 and monotonic; flange weights monotonic, SO ≤ WN, blind ≥ WN at NPS 4+; hub X > pipe OD and monotonic; reducing-tee M ≤ run C and M shrinks with outlet.

## Flags

- none

No internal flags. That means the tables agree with themselves and with the arithmetic of the standards; it does not mean the numbers are right. Use `recall_confidence` to order your checks.

## Check these first (lowest confidence)
- **B16.11 socket-weld 45° elbow A dimensions** — both classes. I am least sure of this column in the whole batch.
- **B16.11 NPS ⅛–⅜** all columns, and **NPS 4 class 6000 A** (3.19).
- **B16.11 NPS 4 class 3000 socket wall C** — I have 0.318; Sch 80 wall for NPS 4 is 0.337. One of these is what the table says.
- **Flange weights class 900 and up** — catalog values, manufacturers differ by ±10%, and my recall is rougher above class 600. Treat every weight as planning-grade, never rigging-grade, until verified.
- **Hub diameter X, class 900 and up.**
- **Reducing tee** 10×3½, 16×14, 24×22.

## Conventions and formulas the calculator will need (not data)
- Socket-weld take-out per fitting = A − (J − gap), where gap is the pipe-end-to-socket-bottom gap (commonly 1/16 in / 1.5 mm per B31.1/B31.3 practice). Cut length between two SW fittings = center-to-center − 2A + 2(J − gap). Use J_min; actual socket depth may be deeper.
- Threaded take-out = fitting center-to-end − thread engagement. Engagement for cut length ≈ L1 + wrench makeup (3 threads); `total_makeup_L1_plus_L3_in` is that number. Fitting center-to-end for threaded fittings (B16.3/B16.11) is not in this batch.
- Hub-at-bevel A for weld-neck flanges equals pipe OD by definition; slip-on bore B is pipe OD plus clearance.
- Tap-drill sizes are the common 75%-thread practice, not a standard's requirement; shops vary.
