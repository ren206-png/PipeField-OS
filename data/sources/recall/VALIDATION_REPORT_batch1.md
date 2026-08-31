# Validation report — batch 1 (flanges B16.5, BW fittings B16.9)

Flange rows: 132 across classes [150, 300, 400, 600, 900, 1500, 2500]
BW fitting rows: 166 (NPS 1/2–24)

Checks run: bolt hole > bolt; RF < bolt circle < OD; bolt hole edge clears RF; LTH WN > LTH SO; bolt count multiple of 4; monotonic OD/thickness/BC/bolt count/bolt size/RF/LTH within class; class 900 NPS ½–2½ == class 1500; class 400 NPS ½–3½ == class 600; RF dia consistent across classes; LR90 A == 1.5×NPS (NPS ≥1); SR90 == NPS; LR45 ≈ 0.625×NPS; tee C ≤ A; monotonic fitting dims.

## Flags

- B16.5 300# NPS 2: bsd 0.625 decreased from previous size (0.75)
- B16.5 400# NPS 2: bsd 0.625 decreased from previous size (0.75)
- B16.5 600# NPS 2: bsd 0.625 decreased from previous size (0.75)
- B16.5 900# NPS 2: bsd 0.875 decreased from previous size (1.0)
- B16.5 900# NPS 3: od 9.5 decreased from previous size (9.62)
- B16.5 900# NPS 3: thk 1.5 decreased from previous size (1.62)
- B16.5 900# NPS 3: bsd 0.875 decreased from previous size (1.0)
- B16.5 900# NPS 3: lwn 4.0 decreased from previous size (4.12)
- B16.5 900# NPS 3: lso 2.12 decreased from previous size (2.5)
- B16.5 900# NPS 6: bsd 1.125 decreased from previous size (1.25)
- B16.5 1500# NPS 2: bsd 0.875 decreased from previous size (1.0)
- B16.5 1500# NPS 6: bsd 1.375 decreased from previous size (1.5)
- B16.5 2500# NPS 2: bsd 1.0 decreased from previous size (1.125)
- B16.9 NPS 3/4: a 1.12 decreased from previous size
- B16.9 NPS 3/4: b 0.44 decreased from previous size
- B16.9 NPS 1: LR45 B 0.88 not ~0.625*NPS (0.625) (check)
- B16.9 NPS 1-1/4: LR45 B 1.0 not ~0.625*NPS (0.78125) (check)
- B16.9 NPS 1-1/2: LR45 B 1.12 not ~0.625*NPS (0.9375) (check)
- B16.9 NPS 2: LR45 B 1.38 not ~0.625*NPS (1.25) (check)
- B16.9 NPS 2-1/2: LR45 B 1.75 not ~0.625*NPS (1.5625) (check)
- B16.9 NPS 3: LR45 B 2.0 not ~0.625*NPS (1.875) (check)
- B16.9 NPS 3-1/2: LR45 B 2.25 not ~0.625*NPS (2.1875) (check)
- B16.9 NPS 22: LR45 B 13.5 not ~0.625*NPS (13.75) (check)

A clean report means the tables are internally consistent. It does NOT mean they are correct. Every row is verified=false until checked against an independent source.
## Flag review (my reading — still not independent verification)

Every flag above is a place where the standard itself is non-monotonic, not a transcription error I can identify:

- **Bolt size drops at NPS 2 (classes 300–2500), NPS 3 (900), NPS 6 (900, 1500):** bolt count doubles or steps up at the same point (4→8, 8→12), so the standard uses a smaller bolt. Expected.
- **900# NPS 3 smaller than NPS 2½ in OD, thickness, LTH:** B16.5 makes class 900 NPS ½–2½ identical to class 1500, so the 3" row is the first true 900# size and is smaller. Expected.
- **B16.9 NPS ¾ LR90/LR45 smaller than NPS ½:** the ½" LR elbow is the known oddity (A = 1.50, not 0.75). Expected.
- **LR45 B not equal to 0.625 × NPS for NPS 1–3½ and NPS 22:** B16.9 45° elbows below NPS 4 carry extra length; the formula only holds from NPS 4. NPS 22 is the row I am least sure of — check 13.50 vs 13.75 first.

## Columns most likely to differ by edition
- Flange **thickness**: minimum thickness values were revised for some Class 150 sizes in a later edition. Verify thickness against the edition your tenant's project specifies before trusting cut lengths that depend on it.
- Flange **weights** and **hub diameters**: not included in this batch; excluded deliberately as highest-error recall.

## How to verify a row
Open your Blue Book or field book to the matching table, compare, and set `verified=true`, `verified_by=<initials>`, `verified_against=<book, page>`. Rows left `false` render with the unverified badge in Field Mode.
