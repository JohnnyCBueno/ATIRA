# ATIRA product charter

## Product promise

ATIRA automatically reconstructs the structure and texture of a person's day, then helps them understand patterns in their life without requiring continuous manual logging.

The user should feel:

> I lived my day. ATIRA did the remembering. I only corrected what mattered.

## Product loop

1. Observe consented signals.
2. Construct chronology from stays, journeys, device activity, health, and calendar context.
3. Propose an interpretation with explicit evidence and uncertainty.
4. Ask a cheap question only when the answer materially improves the record or future inference.
5. Learn from reversible corrections.
6. Turn the corrected record into daily reflection, patterns, and annual retrospectives.

## Product layers

- **Reconstruction:** where, when, movement, device activity, and physiological signals.
- **Interpretation:** likely work mode, exercise, commute, sleep, learning, social time, and recovery.
- **Reflection:** changes, routines, correlations, and Wrapped-style summaries.

## Non-negotiables

- A useful day must exist without manual logging.
- Unknown and missing coverage are valid states.
- Evidence precedes narrative.
- Confidence and provenance are inspectable.
- Corrections are quick, reversible, and never punitive.
- Default language is descriptive rather than moralising.
- Raw sensor observations remain local unless a future feature has an explicit, narrow reason to move them.
- Platform limitations must reduce precision, not honesty.

## Initial product boundary

The initial product proves the daily reconstruction loop. It does not initially include banking, social feeds, employer reporting, medical advice, universal productivity scores, or cloud storage of raw sensor streams.

Desktop activity is an early companion source because it materially improves workday interpretation. It describes work modes such as creation, communication, meetings, research, and administration; it does not declare all computer time productive.

## Prototype question

> Does a multi-source reconstruction of an ordinary day feel meaningfully more useful than a location history or manual habit tracker?

The fixture-driven prototype must answer that question before real collectors dictate the experience.
