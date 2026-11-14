# Rebase notes

## Which file did both runs change?

Both runs changed the `overlaps` function in `conflict/clash.ts`. Run 3 made the dates inclusive. Run 5 skipped
ranges with no start date. They touched the same lines, so Git could not merge them.

## How I resolved it

I kept both changes. The function skips a range with no start date, and it compares dates with `<=`. I removed the
conflict markers and checked that each side's rule still holds.

## What I ran after the rebase

I ran the gate on the merged file again with `bun run gate`. The first run passed before the rebase, but only the
second run says the two changes work together.
