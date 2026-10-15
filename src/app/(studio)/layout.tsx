import { redirect } from "next/navigation";
import { identity } from "@/server/auth";
import { Shell } from "@/components/shell";
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await identity())) redirect("/login");
  return <Shell>{children}</Shell>;
}
