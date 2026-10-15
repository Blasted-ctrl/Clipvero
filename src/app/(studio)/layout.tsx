import { redirect } from "next/navigation";
import { currentUser, usesFastAPI } from "@/server/backend";
import { Shell } from "@/components/shell";
import { FoundationShell } from "@/components/foundation";
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentUser())) redirect("/login");
  if (usesFastAPI()) return <FoundationShell>{children}</FoundationShell>;
  return <Shell>{children}</Shell>;
}
