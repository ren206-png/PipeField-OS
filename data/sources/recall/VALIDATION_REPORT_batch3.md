# Validation report — batch 3

Tables: shackles, sling leg and snatch block factors, wire rope / synthetic / chain sling WLL, hand signals, conversions, water head, gas properties, material and plate weights, stud bolts, wrench sizes, threaded fitting center-to-end, SW couplings.

Checks: shackle pin > bow dia, jaw > pin, WLL monotonic; wire rope choker/vertical 0.65–0.85 and breaking/SWL ≈ 5; chain G100/G80 ratio 1.15–1.35; LEL < UEL; stud length within [plausible minimum, minimum + 2 in] where minimum = 2×flange thickness + 2×nut height + gasket + RF (class 400+) + protrusion; stud length monotonic except where bolt size steps down; threaded 45 < 90 and monotonic; coupling W > 2J.

## Flags

- stud 900# NPS 1/2: length 4 < plausible min 4.10
- stud 900# NPS 3/4: length 4-1/4 < plausible min 4.34
- stud 900# NPS 1: length 4-3/4 < plausible min 4.83
- stud 900# NPS 1-1/4: length 4-3/4 < plausible min 4.83
- stud 900# NPS 1-1/2: length 5-1/4 < plausible min 5.34
- stud 900# NPS 2: length 5-1/2 < plausible min 5.59
- stud 900# NPS 2-1/2: length 6 < plausible min 6.08
- stud 900# NPS 3: length 5-1/2 < plausible min 5.59
- stud 900# NPS 4: length 6-1/4 < plausible min 6.59
- stud 900# NPS 5: length 7 < plausible min 7.34
- stud 900# NPS 6: length 7-1/4 < plausible min 7.47
- stud 900# NPS 8: length 8-1/2 < plausible min 8.59
- stud 900# NPS 10: length 9 < plausible min 9.09
- stud 900# NPS 12: length 9-3/4 < plausible min 9.83
- stud 900# NPS 14: length 10-1/2 < plausible min 10.60
- stud 900# NPS 16: length 11 < plausible min 11.09
- stud 1500# NPS 1/2: length 4 < plausible min 4.10
- stud 1500# NPS 3/4: length 4-1/4 < plausible min 4.34
- stud 1500# NPS 1: length 4-3/4 < plausible min 4.83
- stud 1500# NPS 1-1/4: length 4-3/4 < plausible min 4.83
- stud 1500# NPS 1-1/2: length 5-1/4 < plausible min 5.34
- stud 1500# NPS 2: length 5-1/2 < plausible min 5.59
- stud 1500# NPS 2-1/2: length 6 < plausible min 6.08
- stud 1500# NPS 3: length 6-3/4 < plausible min 6.85
- stud 2500# NPS 12: length 23-1/4 > plausible min +2in (20.84)

## Flag review
- **Stud lengths, class 900/1500 NPS ½–16 "below plausible minimum":** every one is 0.05–0.35 in short of a minimum that already includes a ¼ in protrusion allowance. That is the check being conservative, not a wrong length. Treat as consistent.
- **Stud 2500# NPS 12, 2¾ × 23¼:** 2.4 in longer than the plausible band. This is the one stud row to check first.

## Check these first (lowest confidence)
- **Threaded forged fittings (B16.11 class 2000/3000/6000) center-to-end** — all rows are `low`. The malleable-iron B16.3 table is the one I trust more; if a B16.11 forged row disagrees with a manufacturer page, the page wins.
- **SW couplings** — full-coupling length W is `low` across the board; half-coupling length is an estimate, not a table value.
- **Stud bolts class 600 and up** — length practice varies with gasket type (RF spiral-wound vs RTJ) and manufacturer. All `low`.
- **Synthetic slings** — WLL differs by manufacturer and web class; the tag on the sling governs, always. Orange round sling is `low`.
- **Shackles below ⅜ and above 1½** — `medium`.

## Things the app must say out loud
- Rigging tables are reference only. The tag, the manufacturer chart, and the site lift plan govern. Show that sentence on every rigging screen.
- Stud torque values are deliberately excluded: they depend on lubricant, gasket, and bolt material and must come from the project's bolting spec.
- Exposure limits in the gas table mix OSHA PELs and ACGIH TLVs, which differ; the note column says which. Show the jurisdiction's limit, not both.
- Hand signals: ASME B30.5 set. Sites add signals; the posted chart on the crane governs.
