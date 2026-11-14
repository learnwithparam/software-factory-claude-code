# Factory on my own repo

## What I ran it on

My own small repo, recipe-box. Issue 12 asks for one change: scale a recipe up or down by a number. It touches
one source file and the README. I chose a small issue with a clear outcome so one run could finish it.

## The gate that fired or held

The gate held. The tests and the lint passed on the first round, and the build stage did not touch a test file.
My deny rules blocked a merge and a forced push, and neither was tried.

## What it cost

The run cost $0.34 against a cap of $2. The build stage was the biggest line.

## What I change next

Add a rule to my CLAUDE.md that says where the scale logic lives, so the spec stage reads one file and not five.
