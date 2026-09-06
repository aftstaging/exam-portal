import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export type ProtectedResource = {
  id: number;
  kind: string;
  title: string;
  hasFile: boolean;
  mimeType?: string | null;
};

export default function ProtectedResourceView({ resource }: { resource: ProtectedResource }) {
  const downloadQuery = trpc.resources.download.useQuery(
    { resourceId: resource.id },
    { enabled: resource.hasFile && Boolean(resource.id), retry: false },
  );
  const url = downloadQuery.data?.url;
  const mime = resource.mimeType;

  if (resource.hasFile && downloadQuery.isLoading) {
    return <div className="mt-5 h-16 animate-pulse rounded-xl bg-[#18093c]" />;
  }

  if (resource.hasFile && url && mime === "application/pdf") {
    return <iframe src={url} title={resource.title} className="mt-5 h-[65vh] w-full rounded-lg border border-white/10 bg-white" />;
  }

  if (resource.hasFile && url && mime?.startsWith("image/")) {
    return <img src={url} alt={resource.title} className="mt-5 max-h-[65vh] w-full rounded-lg border border-white/10 object-contain" />;
  }

  if (resource.hasFile && url) {
    return (
      <Button className="mt-5 aft-button" onClick={() => window.open(url, "_blank", "noopener")}>
        <FileText className="mr-2 h-4 w-4" /> Open secure resource
      </Button>
    );
  }

  if (downloadQuery.isError) {
    return <p className="mt-5 text-sm text-[#ff8278]">{downloadQuery.error.message}</p>;
  }

  return <p className="mt-5 text-sm text-white/45">No published file is attached to this resource yet.</p>;
}