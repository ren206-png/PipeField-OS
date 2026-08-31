# Field Mode Calc — Owner Verification Test Cases Needed

Each row below needs a pipefitter or engineer to verify the Expected column against physical tables or a trusted reference.  
All inputs are realistic field values. Expected = ? means not yet verified.

---

## 1. simpleOffset (offset + angle)

| # | offset | angle | expected travel | expected run | Expected |
|---|--------|-------|-----------------|--------------|---------|
| 1 | 6 in   | 22.5° | ?               | ?            | ?       |
| 2 | 12 in  | 30°   | ?               | ?            | ?       |
| 3 | 24 in  | 45°   | ?               | ?            | ?       |
| 4 | 36 in  | 60°   | ?               | ?            | ?       |
| 5 | 18 in  | 22.5° | ?               | ?            | ?       |

---

## 2. rollingOffset

| # | rise  | roll  | angle | expected true_offset | expected travel | Expected |
|---|-------|-------|-------|----------------------|-----------------|---------|
| 1 | 6 in  | 6 in  | 45°   | ?                    | ?               | ?       |
| 2 | 12 in | 6 in  | 30°   | ?                    | ?               | ?       |
| 3 | 8 in  | 6 in  | 22.5° | ?                    | ?               | ?       |
| 4 | 9 in  | 12 in | 45°   | ?                    | ?               | ?       |
| 5 | 18 in | 0     | 45°   | 18 in (= simple offset) | ?           | ?       |

---

## 3. cutLengthButtWeld

| # | NPS | fittings | C-to-C | standard/edition | expected cut length | Expected |
|---|-----|----------|--------|-----------------|---------------------|---------|
| 1 | 3   | two 90° LR elbows | 24 in | ASME B16.9 2018 | ? | ?       |
| 2 | 6   | tee + 90° LR elbow | 48 in | ASME B16.9 2018 | ? | ?       |
| 3 | 2   | reducer + 90° LR elbow | 36 in | ASME B16.9 2018 | ? | ?       |
| 4 | 8   | WN flange CL150 + 90° LR elbow | 60 in | ASME B16.5 2017 | ? | ? |
| 5 | 4   | two 45° LR elbows | 60 in | ASME B16.9 2018 | ? | ?       |

---

## 4. cutLengthSocketWeld

| # | NPS | fittings | C-to-C | class | expected cut length | Expected |
|---|-----|----------|--------|-------|---------------------|---------|
| 1 | 1/2 | two 90° SW elbows | 12 in | 3000 | ? | ?       |
| 2 | 3/4 | coupling both ends | 12 in | 3000 | ? | ?       |
| 3 | 1   | 45° elbow + coupling | 18 in | 3000 | ? | ?       |
| 4 | 1-1/2 | two 90° SW elbows | 24 in | 6000 | ? | ?       |
| 5 | 2   | tee run + coupling | 36 in | 3000 | ? | ?       |

---

## 5. cutLengthThreaded

| # | NPS | fittings | C-to-C | expected cut length | Expected |
|---|-----|----------|--------|---------------------|---------|
| 1 | 1/2 | two 90° elbows | 10 in | ? | ?       |
| 2 | 3/4 | 90° elbow + coupling | 12 in | ? | ?       |
| 3 | 1   | two 45° elbows | 18 in | ? | ?       |
| 4 | 1-1/2 | 90° tee + elbow | 24 in | ? | ?       |
| 5 | 2   | two 90° elbows | 36 in | ? | ?       |

---

## 6. oddAngleCut

| # | NPS | radius | target angle | expected cut_back | expected arc_length | Expected |
|---|-----|--------|-------------|-------------------|---------------------|---------|
| 1 | 6   | LR     | 30°         | ?                 | ?                   | ?       |
| 2 | 8   | LR     | 22.5°       | ?                 | ?                   | ?       |
| 3 | 4   | LR     | 45°         | ?                 | ?                   | ?       |
| 4 | 3   | LR     | 60°         | ?                 | ?                   | ?       |
| 5 | 1/2 | LR     | 45°         | ?                 | ? (verify radius)   | ?       |

---

## 7. twoHoleFlange (flange rotation)

| # | NPS | class | target rotation | expected achievable rotation | expected hole_offset | Expected |
|---|-----|-------|-----------------|------------------------------|----------------------|---------|
| 1 | 4   | 150   | 30°             | ?                            | ?                    | ?       |
| 2 | 6   | 300   | 22.5°           | ?                            | ?                    | ?       |
| 3 | 8   | 150   | 45°             | ?                            | ?                    | ?       |
| 4 | 2   | 600   | 15°             | ?                            | ?                    | ?       |
| 5 | 12  | 150   | 0°              | 0°                           | 0 mm                 | ?       |

---

## 8. branchLayout (fishmouth ordinates)

| # | header OD | branch OD | angle | station | expected ordinate | Expected |
|---|-----------|-----------|-------|---------|-------------------|---------|
| 1 | 8.625 in  | 4.5 in    | 90°   | 30°     | ?                 | ?       |
| 2 | 8.625 in  | 4.5 in    | 90°   | 60°     | ?                 | ?       |
| 3 | 12.75 in  | 6.625 in  | 90°   | 90°     | ?                 | ?       |
| 4 | 6.625 in  | 4.5 in    | 90°   | 120°    | ?                 | ?       |
| 5 | 10.75 in  | 6.625 in  | 45°   | 90°     | ? (owner-verify lateral formula) | ? |

---

## 9. miter

| # | NPS  | OD mm   | total angle | segments | expected cut_angle | Expected |
|---|------|---------|-------------|----------|--------------------|---------|
| 1 | 6    | 168.275 | 45°         | 3        | 11.25°             | ?       |
| 2 | 8    | 219.075 | 90°         | 5        | 11.25°             | ?       |
| 3 | 4    | 114.3   | 30°         | 2        | 15°                | ?       |
| 4 | 12   | 323.85  | 45°         | 4        | 7.5°               | ?       |
| 5 | 6    | 168.275 | 90°         | 3        | 22.5°              | ?       |

---

## 10. pipeWeight

| # | OD mm   | wall mm | length | expected weight_kg | Expected |
|---|---------|---------|--------|---------------------|---------|
| 1 | 168.275 | 7.11    | 6 m    | ?                   | ?       |
| 2 | 219.075 | 8.18    | 12 m   | ?                   | ?       |
| 3 | 114.3   | 6.02    | 3 m    | ?                   | ?       |
| 4 | 323.85  | 9.53    | 6 m    | ?                   | ?       |
| 5 | 60.325  | 3.91    | 10 m   | ?                   | ?       |

---

## 11. slingLegTension

| # | load_kg | legs | angle_from_horizontal | expected leg_tension | Expected |
|---|---------|------|-----------------------|----------------------|---------|
| 1 | 5000    | 2    | 60°                   | ?                    | ?       |
| 2 | 2000    | 4    | 45°                   | ?                    | ?       |
| 3 | 800     | 1    | 90° (vertical)        | ?                    | ?       |
| 4 | 3000    | 2    | 30°                   | ?                    | ?       |
| 5 | 10000   | 4    | 60°                   | ?                    | ?       |

---

## 12. shackleSWL

| # | bow_size_in | applied_load_kg | expected swl_kg | pass/fail | Expected |
|---|-------------|-----------------|-----------------|-----------|---------|
| 1 | 1/2         | 500             | ?               | ?         | ?       |
| 2 | 3/4         | 1500            | ?               | ?         | ?       |
| 3 | 1           | 3000            | ?               | ?         | ?       |
| 4 | 3/4         | 2000            | ?               | ExceedsSWL? | ?    |
| 5 | 1-1/4       | 4000            | ?               | ?         | ?       |

---

## 13. studAndWrenchLookup

| # | NPS | class | expected stud_dia | expected stud_length | expected count | Expected |
|---|-----|-------|-------------------|----------------------|----------------|---------|
| 1 | 4   | 150   | ?                 | ?                    | ?              | ?       |
| 2 | 6   | 300   | ?                 | ?                    | ?              | ?       |
| 3 | 8   | 150   | ?                 | ?                    | ?              | ?       |
| 4 | 2   | 600   | ?                 | ?                    | ?              | ?       |
| 5 | 12  | 150   | ?                 | ?                    | ?              | ?       |

---

**Instructions for owner verification:**  
1. Look up each input in the appropriate ASME/API table or physical fitting.  
2. Fill in the Expected column with the measured/table value.  
3. Add a row to the corresponding `it.todo` stub in the test file and mark it as a real `it(...)` test.  
4. Commit with `verified_by` attribution.
