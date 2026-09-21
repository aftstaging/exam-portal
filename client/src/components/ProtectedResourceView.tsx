import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export type ProtectedResource = {
  id: number;
  kind: string;
  title: string;
  hasFile: boolean;
  mimeType?: string | null;
  email?: { from: string; to: string; subject: string; html: string } | null;
};

export default function ProtectedResourceView({ resource }: { resource: ProtectedResource }) {
  if (resource.email) {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-[#18093c]">
        <div className="border-b border-white/10 bg-[#102b36] px-5 py-4">
          <h3 className="text-base font-bold text-white">{resource.email.subject || "Email attachment"}</h3>
          <p className="mt-2 text-xs leading-5 text-white/55">From: <span className="text-white/80">{resource.email.from || "—"}</span></p>
          <p className="text-xs leading-5 text-white/55">To: <span className="text-white/80">{resource.email.to || "—"}</span></p>
        </div>
        {resource.email.html && <div className="max-h-[55vh] overflow-auto px-5 py-4 text-sm leading-7 text-[#e9e4ff] break-words" dangerouslySetInnerHTML={{ __html: resource.email.html }} />}
      </div>
    );
  }

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
    const viewerUrl = `${url}#toolbar=0&navpanes=0&zoom=page-width&view=FitH`;
    return <iframe src={viewerUrl} title={resource.title} className="mt-5 h-[70vh] w-full rounded-lg border border-white/10 bg-white" />;
  }

  if (resource.hasFile && url && mime?.startsWith("image/")) {
    return <img src={url} alt={resource.title} className="mt-5 max-h-[70vh] w-full rounded-lg border border-white/10 object-contain" />;
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