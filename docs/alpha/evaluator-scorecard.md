# Private-Alpha Evaluator Scorecard

Complete this without coaching from the Igris team. Record failures and
confusion as observed; do not infer what a step was intended to mean.

## Session Facts

- Date:
- Role and relevant Python experience:
- Operating system and Python version:
- Artifact source (supplied wheel or locally built wheel):
- Started at:
- First successful guarded execution at:
- Embedded path completed at:
- Connected attempted? Yes / No
- If no, why not?

## Rating Scale

Use the same neutral five-point scale unless a question specifies otherwise:

1. Strongly disagree
2. Disagree
3. Neither agree nor disagree
4. Agree
5. Strongly agree

## Embedded Evaluation

| Statement | Rating (1-5) | Notes |
| --- | --- | --- |
| I completed Embedded setup without help. | | |
| I could tell whether each sample action executed. | | |
| I understand what the local journal proves. | | |
| I understand what the local journal does not prove. | | |
| The no-network boundary in Embedded mode was credible and clear. | | |
| The allowed, denied, and failed cases matched my expectations. | | |
| I could locate and verify the journal without help. | | |
| I would add Igris to a second consequential action. | | |

Measured time from start to first successful guarded execution: ______ minutes.

Measured time to complete the full Embedded quickstart: ______ minutes.

Did you request help, search outside the supplied kit, or change an
undocumented command? If yes, describe exactly what was needed:

## Connected Evaluation (If Attempted)

| Statement | Rating (1-5) | Notes |
| --- | --- | --- |
| I can explain what contract synchronization sends. | | |
| I can explain what explicit evidence synchronization sends. | | |
| I understand that execution remained local. | | |
| I understand that verified evidence does not prove an external side effect. | | |
| Evidence sync/status provided useful information. | | |
| The difference between Embedded, Connected, and Managed was clear. | | |

In your own words, what left your machine in Connected mode?

What did `evidence_state=verified` mean to you before reading the explanation,
and what does it mean now?

## Open Questions

1. Which step felt unnecessary, confusing, or risky?
2. Where did you pause longest, and why?
3. What did you initially believe the journal proved?
4. What existing tool, code, or process would you otherwise use for this action?
5. What would prevent you from guarding a second action?
6. Which centralized capability, if any, would be valuable: evidence storage,
   evidence search, shared policy, team approval, or something else?
7. Would your team pay for any of those capabilities? Why or why not?
8. What important question did this scorecard fail to ask?

## Alpha Success Criterion

The private alpha succeeds only if all of the following are true across the
evaluation cohort:

- at least 80% of evaluators complete Embedded without live Igris-team help;
- the median first successful guarded execution is at most 10 minutes;
- at least 80% complete the full Embedded path in at most 15 minutes;
- at least 80% correctly identify whether allowed, denied, and failed functions
  executed;
- at least 80% can state both one thing the journal proves and one thing it does
  not prove;
- no evaluator reports being led to believe the synthetic refund moved money,
  Connected verification made execution Managed, or verification proved an
  external side effect.

Interest, willingness to pay, and second-action intent are discovery signals,
not pass conditions. Report the full distribution and qualitative responses;
do not discard neutral or negative feedback.
