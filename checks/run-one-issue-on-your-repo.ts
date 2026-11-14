// run-one-issue-on-your-repo: the step check is the capstone check.
// Both read only the learner's own folder, never the course library.

import { rules } from "../capstone/check";
import type { Rule } from "../scripts/verify";

export default rules satisfies Rule[];
