# ATIRA product charter

## Product promise

ATIRA automatically reconstructs the structure and texture of a person's day, then proactively discovers explanations, patterns and personal tendencies without requiring continuous manual logging. Over time it should tell users useful things about how they characteristically act, react and recover that they may not have recognized themselves.

The user should feel:

> I lived my life. ATIRA remembered it, found the pattern, and told me something I had not seen. I only corrected what mattered.

## Product loop

1. Observe consented signals.
2. Construct chronology from stays, journeys, device activity, health, and calendar context.
3. Place each episode in a multi-horizon context containing what preceded, overlapped and followed it.
4. Generate competing explanations and make the strongest inspectable assertion justified by the personal model.
5. Ask a cheap question only when the answer materially improves discrimination or future inference.
6. Learn from corrections and test hypotheses against subsequent comparable events.
7. Promote repeatedly predictive relationships into personal tendencies, patterns and annual retrospectives.

## Product layers

- **Reconstruction:** where, when, movement, device activity, and physiological signals.
- **Interpretation:** likely work mode, exercise, commute, sleep, learning, social time, and recovery.
- **Explanation:** why comparable episodes differ, which preceding conditions matter, and which competing hypothesis best fits.
- **Personal model:** recurring reactions, routines, recovery, preferences and behavioural tendencies that strengthen or change over time.
- **Reflection:** discoveries, changes, predictions, and Wrapped-style summaries.

## Presentation rule

Raw observations, aggregate audits, and meaningful life events are separate product objects. Location supplies the primary chronology. Repeated digital activity is aggregated by application and time, while idle states and short switches remain evidence unless another source makes them meaningful.

Digital activity is always device-qualified. The same application on a phone and laptop remains separate evidence unless the user explicitly requests a cross-device rollup. Device activity inherits place context through timestamped evidence, allowing ATIRA to distinguish office, home, and travel use without declaring all computer time to be work.

## Non-negotiables

- A useful day must exist without manual logging.
- Unknown and missing coverage are valid states.
- Evidence precedes narrative.
- ATIRA takes interpretive initiative; it does not use uncertainty as a reason to avoid useful judgment.
- Assertions may be wrong, but must be traceable, falsifiable, correctable and capable of improving.
- Every source may provide context for every life domain when timing and explanatory value justify the relationship.
- Confidence and provenance are inspectable.
- Corrections are quick, reversible, and never punitive.
- Default language is direct and assertive without becoming moralising or diagnostic.
- Raw sensor observations remain local unless a future feature has an explicit, narrow reason to move them.
- Platform limitations must reduce precision, not honesty.

## Initial product boundary

The initial product proves the daily reconstruction loop. It does not initially include banking, social feeds, employer reporting, medical advice, universal productivity scores, or cloud storage of raw sensor streams.

Desktop activity is an early companion source because it materially improves workday interpretation. It describes work modes such as creation, communication, meetings, research, and administration; it does not declare all computer time productive.

## Prototype question

> Does a multi-source reconstruction of an ordinary day feel meaningfully more useful than a location history or manual habit tracker?

The fixture-driven prototype must answer that question before real collectors dictate the experience.
