---
source_id: firm-spend-categorisation-standard-v3
title: "Spend categorisation standard, version 3 — internal methodology memo"
author: Analytics practice lead
client: Internal
deliverable: Methodology memo
period: 2026
published: 2026-07-30
added: 2026-07-30
kind: deliverable
capture: synthetic
---

# Spend categorisation standard, version 3

> **Synthetic demo data.** An invented internal memo for a fictional firm.

**Applies to:** every credit card spend analysis produced from Q3 2026. Analyses
produced under version 2 are **not restated**.

## Why a new version

Version 2 categorised any charge to a registered charity as *charitable*. The
philanthropy team then had to re-examine those charges to work out which were gifts and
which were purchases (gala tables, auction items, raffle tickets, memberships with
benefits). The two teams' numbers for the same client disagreed, and clients noticed.

## Categories

| category | definition |
|---|---|
| Travel | transport, lodging, travel insurance, foreign transaction fees |
| Dining | restaurants, delivery, bars |
| Household & retail | groceries, home goods, clothing, personal care |
| Home & garden | contractors, maintenance, garden, furniture over $500 |
| Children & education | tuition, childcare, activities, school supplies |
| Medical & pharmacy | providers, pharmacies, equipment |
| Subscriptions | recurring charges of the same amount in three or more consecutive months |
| **Events & memberships** (new) | charity galas and tables, auction purchases, raffle tickets, club and museum memberships |
| Charitable | gifts to registered charities where **no goods or services** are received |
| Other | everything else |

## Rules

1. **Charity-related purchases go to Events & memberships**, not Charitable and not
   Dining, at the full amount charged. Flag them `possible-charitable`. The
   philanthropy team determines the deductible portion in the giving summary; the card
   analysis never states tax treatment.
2. A **subscription is "unused"** when there is no correlated activity for 90 days and
   the client confirms it on review. Report the annualised saving from cancellation.
3. **Rewards points** are valued at 1.5 cents per point unless the programme publishes a
   different redemption value.
4. Every charge over $1,000 is reviewed by hand.
5. Where an analysis for a prior period used version 2, say so in the method note and
   do not compare Charitable or Dining totals across versions without adjustment.
