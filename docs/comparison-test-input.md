Comparison Page test cases (`/compare`) 

Use:
- `Herb 1`
- `Herb 2`
- `Symptom`
- `Age group`

1. Respiratory match test
- Herb 1: `Vitex negundo` (Lagundi)
- Herb 2: `Blumea balsamifera` (Sambong)
- Symptom: `cough`
- Age group: `adult`
- Expect: `Vitex negundo` should score better on symptom match.

2. Skin/fungal match test
- Herb 1: `Senna alata` (Akapulko)
- Herb 2: `Psidium guajava` (Bayabas)
- Symptom: `ringworm`
- Age group: `adult`
- Expect: `Senna alata` should lead.

3. GI match test
- Herb 1: `Carmona retusa` (Tsaang-gubat)
- Herb 2: `Mentha cordifolia` (Yerba Buena)
- Symptom: `stomach pain`
- Age group: `adult`
- Expect: `Mentha cordifolia` should have stronger direct symptom match.

4. Gout/arthritis test
- Herb 1: `Peperomia pellucida` (Ulasimang-bato)
- Herb 2: `Blumea balsamifera` (Sambong)
- Symptom: `gout`
- Age group: `adult`
- Expect: `Peperomia pellucida` should lead on symptoms.

5. Metabolic test
- Herb 1: `Momordica charantia` (Ampalaya)
- Herb 2: `Psidium guajava` (Bayabas)
- Symptom: `diabetes`
- Age group: `adult`
- Expect: `Momordica charantia` should lead, but check safety detail counts too.

6. Child dosage context test
- Herb 1: `Psidium guajava` (Bayabas)
- Herb 2: `Senna alata` (Akapulko)
- Symptom: `diarrhea`
- Age group: `child`
- Expect: `Psidium guajava` should win on symptom + dosage suitability.

7. Safety-profile presence contrast
- Herb 1: `Mentha cordifolia` (Yerba Buena)
- Herb 2: `Vitex negundo` (Lagundi)
- Symptom: `headache`
- Age group: `adult`
- Expect: compare “Safety profile available” differences and interaction/contraindication counts.

If you want, after you run these, I can help you define pass/fail criteria per section (`symptomMatch`, `dosage`, `safetyScore`, `reasoning`) so QA is consistent.