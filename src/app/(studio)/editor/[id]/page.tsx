import { usesFastAPI } from "@/server/backend";
import { Editor } from "@/components/editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Editor id={id} foundation={usesFastAPI()} />;
}
