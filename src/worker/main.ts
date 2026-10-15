import { setTimeout } from "node:timers/promises";
import {
  claimJob,
  finishJob,
  heartbeat,
  recoverExpiredJobs,
} from "../server/jobs";
import { tickPipelines } from "../server/pipelines";
import { run } from "../server/db";
import { generate } from "./generate";
import { renderProject, closeRenderer } from "./render";
import { timelineSchema } from "../lib/model";

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
async function main() {
  console.log("Clipvero worker ready. Polling the durable queue.");
  while (!stopping) {
    try {
      run(
        "INSERT OR REPLACE INTO system_state VALUES ('worker_heartbeat', ?)",
        String(Date.now()),
      );
      recoverExpiredJobs();
      tickPipelines();
      const job = claimJob();
      if (!job) {
        await setTimeout(1500);
        continue;
      }
      const timer = setInterval(() => {
        heartbeat(job.id);
        run(
          "INSERT OR REPLACE INTO system_state VALUES ('worker_heartbeat', ?)",
          String(Date.now()),
        );
      }, 15000);
      try {
        if (job.kind === "generate") await generate(job);
        else {
          const input = JSON.parse(job.input);
          await renderProject(
            job,
            timelineSchema.parse(input.timeline),
            job.projectId!,
            job.revision,
          );
        }
        finishJob(job);
        console.log(
          JSON.stringify({
            event: "job.completed",
            jobId: job.id,
            workspaceId: job.workspaceId,
          }),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error stopped this job.";
        finishJob(job, message);
        console.error(
          JSON.stringify({
            event: "job.failed",
            jobId: job.id,
            error: message,
          }),
        );
      } finally {
        clearInterval(timer);
      }
    } catch (error) {
      console.error(
        "Worker loop:",
        error instanceof Error ? error.message : "Unknown error",
      );
      await setTimeout(3000);
    }
  }
  await closeRenderer();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
