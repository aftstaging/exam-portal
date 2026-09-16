import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResourceModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#120730]/80 p-2 sm:p-5" onClick={onClose} role="dialog" aria-modal="true">
      <Card className="flex max-h-[88vh] w-full max-w-5xl flex-col gap-0 border-[#00e5ff]/30 bg-[#120730]" onClick={(event) => event.stopPropagation()}>
        <CardHeader className="flex-row items-center justify-between rounded-t-xl border-b border-white/10 px-6 py-4">
          <CardTitle className="text-white">{title}</CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close resource"><X className="h-5 w-5" /></Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden overflow-y-auto px-4 py-4 sm:px-6">{children}</CardContent>
      </Card>
    </div>
  );
}