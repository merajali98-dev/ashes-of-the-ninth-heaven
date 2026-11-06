# Forbidden Lineages expansion design

The expansion adds 480 authored techniques to the original 117: 60 for each of Iron Oath, Cinder Art, Grave Tide, Hollow Veil, Jade Sutra, Storm Script, Astral Seal, and Common Form. The collection gains eight mechanical types alongside Strike, Ward, Mantra, and Remedy. A type describes how a technique plays, while its school describes its lineage and its rarity describes its availability and complexity.

## Two combatants, one battlefield

Every fight remains a duel between the player and one enemy. Formations and stances are timed effects attached to their owner; they are not creatures, lanes, independent targets, or extra combatants. Rituals are queued effects. They cannot attack independently after combat ends. The existing enemy intent remains the central defensive decision.

## Type contract

| Type | Distinct decision | Mechanical signature | Fairness constraint |
| --- | --- | --- | --- |
| Hex | Establish an affliction before amplifying it. | Hostile status baseline; `afflicted` conditional bonus. | Check the target before the card applies its own statuses. Prefer debuff variety over huge poison stacks. |
| Formation | Spend tempo now for predictable later value. | Aura on `turn-start` or `turn-end`, lasting two or three owner turns. | Count the complete lifetime when pricing it. Persistent Strength and Focus are especially expensive. |
| Stance | Change the payoff of subsequent actions. | Aura on `on-attack`, `on-guard`, or `on-status`, lasting two or three owner turns. | Trigger once per directly played card, never recursively from triggered effects. Avoid Qi generation on attack/guard triggers. |
| Counter | Establish Guard, then turn that preparation into pressure. | `guarded` conditional bonus. | It is a technique played on the player's turn, not an invisible enemy-turn interrupt. State the Guard requirement clearly. |
| Pact | Exchange current vitality for immediate advantage. | Positive `healthCost`, paid before effects. | Full payment must leave at least one vitality. A pact cannot become free at one vitality. Avoid self-healing that erases its price. |
| Ritual | Commit to a payoff after surviving another enemy action. | `delayed` effects after one or two owner turn starts. | Queue once. Keep an immediate minor effect where needed so the cast is legible. Delayed burst still respects enemy phase seals. |
| Transmute | Alter access to spent resources or remove enemy advantages. | `recover` exhausted techniques to discard, or `dispel` enemy positive statuses. | Recovery never puts cards directly in hand and excludes all recovery-bearing techniques. Recovery effects exhaust. |
| Finisher | Arrange the hand or school chain for a decisive release. | `resonant` or `empty-hand` bonus, usually damage and usually exhaust. | Useful baseline, but full payoff requires setup. Do not combine easy Qi refund, draw, and recover into a repeatable loop. |

The `kind` field remains `attack` or `skill` for existing combat rules. The explicit `type` field selects the twelve-type identity. A damaging ritual can still be a skill if its damage occurs later; an attack stance's triggered damage does not itself become a played attack.

## Conditions and timing

Conditions are a single snapshot taken after removing the played card from the hand, before paying vitality or resolving any effects:

- `guarded`: the player currently has at least one Guard.
- `wounded`: the player is at or below half maximum vitality.
- `afflicted`: the enemy currently has Burn, Poison, Bleed, Weak, or Vulnerable.
- `resonant`: the played non-neutral school matches the current chain and at least two chain steps are already present.
- `empty-hand`: no cards remain in the player's hand.

This snapshot prevents a hex from qualifying itself, a pact from wounding itself into an unadvertised bonus, or a draw effect from unexpectedly cancelling a finisher. Neutral techniques continue to preserve the school chain, but cannot claim a school finisher bonus themselves. Neutral finishers use the empty-hand condition.

An aura activates after the card's immediate effects; it does not trigger on its own installation. A source card can trigger an existing aura at most once, even if it has multiple damage hits or multiple Guard effects. Aura, ritual, resonance, and status effects cannot recursively activate action auras. Turn triggers occur on the owner's turns. At most three distinct auras can be active; attempting to add a fourth is rejected before paying any cost. Replaying the same aura card refreshes its duration instead of stacking another copy. Action and turn-end auras expire at the start of their casting turn plus duration; a turn-end aura first pays out on its casting turn. Turn-start auras pay out on each of the next two or three starts, including their final start before expiring. Pending effects expire when the duel resolves and persist through save/reload while the duel continues.

For deterministic removal, dispel can remove a total number of positive stacks in the fixed order Strength, Focus, Regeneration, Ward. The UI must state whether an amount counts stacks or whole status types and agree with the implemented rule. Recovery should use a stable pile order and show how many techniques actually returned.

## School identity

| School | Expansion emphasis | Limits that preserve identity |
| --- | --- | --- |
| Iron Oath | Guard counters, oath pacts, disciplined stance attacks, exposed meridians. | Damage comes from preparing defense; little unconditional card flow. |
| Cinder Art | Burn hexes, dangerous vitality payments, banked furnace rituals, exhausting explosions. | Recovery is narrow and costly; healing does not cancel the pact's sacrifice. |
| Grave Tide | Poison, small repeated healing, delayed returns, exhausted-card recovery. | Slow value dominates; cheap immediate burst stays modest. |
| Hollow Veil | Weak, Bleed, Vulnerable, last-card finishers, removal of enemy advantages. | Guard and healing are secondary; setup creates the lethal opening. |
| Jade Sutra | Focus, Ward, cleansing, defensive formations, patient rituals. | Long-term survivability costs immediate pressure; permanent scaling stays scarce. |
| Storm Script | Multi-action turns, strike stances, precise Qi refunds, resonance finishers. | Cheap flow exhausts or requires setup; no recursive free-card engine. |
| Astral Seal | Draw planning, turn-start formations, delayed celestial decrees, chain finishers. | Draw competes with immediate defense and damage. |
| Common Form | Accessible counters, practical recovery, modest pacts, last-card finishes. | No school-resonance condition; reliability comes with smaller peak payoffs. |

## Collection and balance targets

Each school's final 60-card roster contains seven of each new type and one each of Strike, Ward, Mantra, and Remedy. Each has 24 common, 20 uncommon, 12 rare, and four legendary techniques, with most costs at one or two Qi and only a small number at zero or three.

An authored technique needs a recognizable tactical purpose and a name rooted in its school's people, places, or practices. Distinctness can come from payoff timing, setup requirements, exhaustion, action order, vitality risk, or supporting a different deck. Merely changing a number, swapping a school label, or copying one effect package under several names is insufficient. Legendary cards should open a strategy or demand an unusual commitment, rather than invalidate lower rarities.

Use the existing common one-Qi attacks around six to eight damage and common Guard around five to eight as an initial baseline. Conditional bonus power should normally add around 40–60% to a card's baseline budget. Formation and stance costs must account for all expected triggers: a small repeated effect can exceed an immediate large effect. Card draw, Qi, multi-hit Strength scaling, permanent Focus, and Poison need additional scrutiny beyond their printed numbers.

Every new technique has a finite acquisition path. Expeditions retain their additional lineage rewards. The later Shop and Workshop expansion supersedes cheap archive learning with cultivation-gated purchases and exact material recipes; see `economy-design.md` for current prices and requirements. Catalog filtering by school, type, rarity, cost, ownership, and search supports the collection. Inspection explains the condition, vitality payment, duration, delayed timing, and exhaustion before the player commits to a cast or purchase.

## Verification priorities

Verify the full authored registry, type coverage, cost and rarity distributions, acquisition reachability, and absence of identical mechanical duplicates within a school. Combat checks should cover condition snapshots, insufficient vitality rejection without mutation, aura expiration and recursion prevention, multiple-hit trigger limits, delayed phase-seal damage, exhausted-card recovery, dispel order, save/reload, and cancellation of pending effects after victory or defeat. The battle view must still show exactly two combatants and preserve readable enemy intent.
