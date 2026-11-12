---
number: 2
title: Splitting a damage charge two ways loses a cent
opened_by: Dana Kowalski (treasurer)
labels: [bug, money]
---

Charge D-301 is £33.33 for the bent pressure washer lance, shared by two borrowers.
`bun run desk split D-301` gives each of them £16.66, which adds up to £33.32.
The books are off by a cent every time a charge does not divide evenly. Every penny of a charge must be billed
to someone, and the shares must add up to the charge.
