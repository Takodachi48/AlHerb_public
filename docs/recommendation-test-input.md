Recommendation Page test cases (Generate tab)

1. Hard-stop red flag test
- Symptoms: `chest pain`
- For: someone else
- Age: `35`
- Gender: `male`
- Severity: `severe`
- Conditions: *(blank)*
- Medications: *(blank)*
- Allergies: *(blank)*
- Expect: `Recommendations Blocked` + red-flag message, no results table.

2. Hypoglycemia risk + exclusions test
- Symptoms: `diabetes, high blood sugar`
- For: someone else
- Age: `45`
- Gender: `female`
- Severity: `moderate`
- Conditions: `G6PD deficiency`
- Medications: `insulin`
- Allergies: *(blank)*
- Expect: candidates reduced by contraindication/drug safety filters; likely fewer final herbs.

3. Pregnancy safety filtering test
- Symptoms: `cough, fever`
- For: someone else
- Age: `29`
- Gender: `female`
- Severity: `moderate`
- Pregnant: `checked`
- Breastfeeding: `unchecked`
- Conditions: *(blank)*
- Medications: *(blank)*
- Allergies: *(blank)*
- Expect: herbs unsafe in pregnancy filtered out; warnings/safe set reflected.

4. Elderly + polypharmacy test
- Symptoms: `stomach pain, diarrhea`
- For: someone else
- Age: `72`
- Gender: `male`
- Severity: `moderate`
- Conditions: `kidney disease`
- Medications: `warfarin, furosemide`
- Allergies: *(blank)*
- Expect: stronger safety filtering; possible interaction-related exclusions.

5. Allergy blocker/warning test
- Symptoms: `headache`
- For: someone else
- Age: `30`
- Gender: `female`
- Severity: `mild`
- Conditions: *(blank)*
- Medications: *(blank)*
- Allergies: `Lamiaceae family`
- Expect: warning/blocker behavior for herbs with matching allergy risk.

6. Combination auto-filter visibility test
- Symptoms: `diabetes`
- For: someone else
- Age: `40`
- Gender: `male`
- Severity: `moderate`
- Conditions: *(blank)*
- Medications: *(blank)*
- Allergies: *(blank)*
- Expect: if conflicting herbs appear in candidate set, message like “X herb(s) were removed due to major or contraindicated combination conflicts.”

7. No-match baseline test
- Symptoms: `nonexistent symptom xyz`
- For: someone else
- Age: `33`
- Gender: `female`
- Severity: `mild`
- Conditions: *(blank)*
- Medications: *(blank)*
- Allergies: *(blank)*
- Expect: no results / graceful empty state.
