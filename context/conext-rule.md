# Shift context and recovery

1. On every new shift, read the most recent dated context file from a previous date first. Use the latest working date when there is a gap. Then read today's file if it exists. On the very first shift, record that there is no earlier file.
2. Immediately create `YYYY-MM-DD-context.md` in this folder using the local working date if it does not exist. Start with a short previous-shift handoff, the current task and the next action. Reuse today's file on restart; never overwrite earlier entries.
3. Follow this rule: **task > done > apni ankhon se test kro > completed**. “Done” means the change exists. Mark “completed” only after personally exercising the relevant normal entry point and recording what actually happened. For UI, open the running page and inspect the result. For a plan, read the finished document and check its claims against source files.
4. Update today's context as work progresses without waiting for a reminder. Write down the active step before starting a chunk. Checkpoint immediately after meaningful edits, tests, decisions and blockers. Keep entries short enough to maintain during work.
5. Each checkpoint records the files or routes touched, observed result, open questions and one exact next action. Distinguish planned, implemented and verified. Never log credentials, tokens or customer records.
6. After a crash, use the latest checkpoint and inspect the working tree before resuming. Preserve unfinished edits and recheck any result that was pending when the interruption happened.
