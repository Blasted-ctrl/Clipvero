import { AuthForm } from "@/components/auth-form";
import { usesFastAPI } from "@/server/backend";
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthForm foundation={usesFastAPI()} />;
}
