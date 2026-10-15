"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { foundationApi } from "@/lib/foundation-api";
import { scriptTimeline, type Project } from "@/lib/model";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { toast } from "sonner";

const formSchema = z.object({
  title: z.string().trim().min(1).max(120),
  script: z.string().trim().min(1).max(12000),
  duration: z.number().int().min(5).max(180),
  aspect: z.enum(["9:16", "1:1", "16:9"]),
});
type Input = z.infer<typeof formSchema>;

export function FoundationProjects({ canEdit }: { canEdit: boolean }) {
  const router = useRouter(),
    client = useQueryClient();
  const [open, setOpen] = useState(false),
    [offset, setOffset] = useState(0),
    [failure, setFailure] = useState("");
  const [deleting, setDeleting] = useState<Project | null>(null),
    [busy, setBusy] = useState(false);
  const intent = useRef<{
    form: string;
    body: { title: string; timeline: Project["timeline"]; creationKey: string };
  } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", script: "", duration: 30, aspect: "9:16" },
  });
  const query = useQuery({
    queryKey: ["foundation", "projects", offset],
    queryFn: () =>
      foundationApi<{ items: Project[]; nextOffset: number | null }>(
        `projects?offset=${offset}&limit=50`,
      ),
  });
  return (
    <div className="foundation-content">
      <span className="eyebrow">YOUR ORIGINAL STORIES</span>
      <div className="page-heading">
        <div>
          <h1>Projects</h1>
          <p className="muted">
            Save a script, shape your scenes, and pick up where you left off.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            New script project
          </Button>
        )}
      </div>
      <p className="notice">
        Timeline editing and preview are available. Private uploads and exports
        are still being connected to this workspace.
      </p>
      {query.isPending ? (
        <p role="status">Loading your projects…</p>
      ) : query.error ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : query.data?.items.length ? (
        <div className="foundation-project-list">
          {query.data.items.map((project) => (
            <article key={project.id}>
              <div>
                <h2>
                  <Link href={`/editor/${project.id}`}>{project.title}</Link>
                </h2>
                <p className="muted">
                  Revision {project.revision} · {project.timeline.aspect} ·{" "}
                  {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="button-row">
                <Button asChild variant="secondary">
                  <Link href={`/editor/${project.id}`}>
                    {canEdit ? "Open editor" : "View timeline"}
                  </Link>
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${project.title}`}
                    onClick={() => setDeleting(project)}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p>
          No projects yet.{" "}
          {canEdit
            ? "Start with your own script to create the first one."
            : "An editor can create your workspace’s first project."}
        </p>
      )}
      <div className="button-row">
        {offset > 0 && (
          <Button
            variant="secondary"
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Previous projects
          </Button>
        )}
        {query.data?.nextOffset != null && (
          <Button
            variant="secondary"
            onClick={() => setOffset(query.data!.nextOffset!)}
          >
            More projects
          </Button>
        )}
      </div>
      <Dialog
        title="Start with your script"
        description="Your words stay unchanged. Separate scenes with blank lines."
        open={open}
        onOpenChange={setOpen}
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            void handleSubmit(async (input) => {
              setFailure("");
              try {
                const form = JSON.stringify(input);
                if (intent.current?.form !== form)
                  intent.current = {
                    form,
                    body: {
                      title: input.title,
                      timeline: scriptTimeline(
                        input.script,
                        input.aspect,
                        input.duration,
                      ),
                      creationKey: crypto.randomUUID(),
                    },
                  };
                const project = await foundationApi<Project>(
                  "projects",
                  "POST",
                  intent.current.body,
                );
                await client.invalidateQueries({
                  queryKey: ["foundation", "projects"],
                });
                router.push(`/editor/${project.id}`);
              } catch (error) {
                setFailure(
                  error instanceof Error
                    ? error.message
                    : "Could not create the project.",
                );
              }
            })(event);
          }}
        >
          <label>
            Project name
            <input {...register("title")} maxLength={120} required />
          </label>
          <label>
            Your script
            <textarea
              {...register("script")}
              rows={6}
              maxLength={12000}
              required
            />
          </label>
          <label>
            Duration in seconds
            <input
              {...register("duration", { valueAsNumber: true })}
              type="number"
              min={5}
              max={180}
              required
            />
          </label>
          <label>
            Aspect ratio
            <select {...register("aspect")}>
              <option value="9:16">Vertical · 9:16</option>
              <option value="1:1">Square · 1:1</option>
              <option value="16:9">Landscape · 16:9</option>
            </select>
          </label>
          {Object.values(errors).map((field, index) => (
            <p className="inline-error" role="alert" key={index}>
              {field.message}
            </p>
          ))}
          {failure && (
            <p className="inline-error" role="alert">
              {failure}
            </p>
          )}
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving your project…" : "Open in editor"}
          </Button>
        </form>
      </Dialog>
      <Dialog
        title="Remove this project?"
        description="It will leave your library. Saved revisions are retained for recovery; permanent deletion is not available yet."
        open={Boolean(deleting)}
        onOpenChange={(value) => {
          if (!value) setDeleting(null);
        }}
      >
        <Button
          disabled={busy}
          onClick={async () => {
            if (!deleting) return;
            setBusy(true);
            try {
              await foundationApi(`projects/${deleting.id}`, "DELETE");
              setDeleting(null);
              await client.invalidateQueries({
                queryKey: ["foundation", "projects"],
              });
              toast.success("Project removed.");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not remove the project.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Remove project
        </Button>
      </Dialog>
    </div>
  );
}
