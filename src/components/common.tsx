"use client";
import Link from "next/link";
import { ArrowRight, Clapperboard, Play } from "lucide-react";
import type { ReactNode } from "react";
import type { Project } from "@/lib/model";
import { duration } from "@/lib/model";
import { Button } from "./ui/button";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon || <Clapperboard size={26} />}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  const label: Record<string, string> = {
    review: "Ready for review",
    completed: "Completed",
    draft: "Draft",
    approved: "Approved",
    queued: "Queued",
    running: "In progress",
    rendering: "Rendering",
    failed: "Failed",
    scheduled: "Reminder set",
  };
  return (
    <span className={`status status-${value}`}>
      <i />
      {label[value] || value}
    </span>
  );
}
export function time(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export function date(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
export function ProjectThumb({ project }: { project: Project }) {
  return (
    <div
      className="project-thumb"
      style={{ backgroundColor: project.timeline.scenes[0].background }}
    >
      <span className="thumb-format">{project.timeline.aspect}</span>
      <div className="thumb-caption">
        {project.timeline.scenes[0].caption.slice(0, 90)}
      </div>
      <span className="thumb-duration">
        {time(duration(project.timeline) / 30)}
      </span>
      <span className="thumb-play">
        <Play size={16} fill="currentColor" />
      </span>
    </div>
  );
}
export function ProjectCards({ projects }: { projects: Project[] }) {
  return (
    <div className="project-grid">
      {projects.map((p) => (
        <Link key={p.id} href={`/editor/${p.id}`} className="project-card">
          <ProjectThumb project={p} />
          <div className="project-card-content">
            <div className="row-between">
              <h3>{p.title}</h3>
              <ArrowRight size={15} />
            </div>
            <div className="row-between">
              <Status value={p.status} />
              <small className="muted">
                {new Date(p.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </small>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
export function CreateButton() {
  return (
    <Button asChild>
      <Link href="/create">
        Create video <ArrowRight size={16} />
      </Link>
    </Button>
  );
}
