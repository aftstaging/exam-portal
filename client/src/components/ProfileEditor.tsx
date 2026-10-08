import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { readFileAsDataUrl } from "@/lib/media";
import { PersonAvatar } from "@/components/PortalUi";

type ProfileData = {
  user: { id: number; name: string | null; email: string | null; role: string };
  profile: {
    bio: string | null; phone: string | null; headline: string | null; employer: string | null; city: string | null; country: string | null;
    dateOfBirth: string | null; linkedinUrl: string | null; targetQualification: string | null; emergencyContactName: string | null;
    emergencyContactPhone: string | null; avatarUrl: string | null;
  };
};

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Editable personal profile shared by learners and instructors: photo, name, bio and the contact and
 * background details each role needs. Blank fields are saved as empty, so clearing a field clears it.
 */
export function ProfileEditor({ data, role }: { data: ProfileData; role: "user" | "instructor" | "admin" }) {
  const utils = trpc.useUtils();
  const isStaff = role === "instructor" || role === "admin";
  const [form, setForm] = useState(() => toForm(data));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setForm(toForm(data)), [data]);

  const update = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile saved");
      utils.profile.me.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const uploadAvatar = trpc.profile.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Profile photo updated");
      utils.profile.me.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) return toast.error("Choose a PNG, JPEG, WebP or GIF photo");
    if (file.size > MAX_AVATAR_BYTES) return toast.error("Photos must be 5 MB or smaller");
    const base64 = await readFileAsDataUrl(file);
    uploadAvatar.mutate({ fileName: file.name, mimeType: file.type, base64 });
  };

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const field = "border-white/10 bg-[#0c0524] text-white placeholder:text-white/35";
  const label = "text-xs font-semibold uppercase tracking-wider text-white/55";

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit border-white/10 bg-[#120730]">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <PersonAvatar name={data.user.name} email={data.user.email} src={data.profile.avatarUrl} size={128} />
          <div>
            <div className="text-lg font-bold text-white">{data.user.name ?? "Your name"}</div>
            <div className="text-sm text-[#c4b5fd]">{isStaff ? "Instructor" : "Learner"}</div>
            <div className="mt-1 break-all text-xs text-white/45">{data.user.email}</div>
          </div>
          <input ref={fileRef} type="file" accept={AVATAR_TYPES.join(",")} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void onPhoto(file); }} />
          <Button type="button" variant="outline" className="border-[#00e5ff] text-[#00e5ff]" disabled={uploadAvatar.isPending} onClick={() => fileRef.current?.click()}>
            {uploadAvatar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            {data.profile.avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          <p className="text-[11px] leading-5 text-white/40">PNG, JPEG, WebP or GIF, up to 5 MB. A clear, square headshot works best.</p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="text-white">Personal details</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><label className={label} htmlFor="p-name">Full name</label><Input id="p-name" value={form.name} onChange={set("name")} maxLength={200} className={field} /></div>
            <div className="space-y-2"><label className={label} htmlFor="p-email">Email</label><Input id="p-email" value={data.user.email ?? ""} disabled className={field} /></div>
            <div className="space-y-2"><label className={label} htmlFor="p-phone">Phone number</label><Input id="p-phone" value={form.phone} onChange={set("phone")} placeholder="+27 82 555 1234" maxLength={40} className={field} /></div>
            <div className="space-y-2"><label className={label} htmlFor="p-dob">Date of birth</label><Input id="p-dob" type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} className={field} /></div>
            <div className="space-y-2"><label className={label} htmlFor="p-city">City</label><Input id="p-city" value={form.city} onChange={set("city")} maxLength={120} className={field} /></div>
            <div className="space-y-2"><label className={label} htmlFor="p-country">Country</label><Input id="p-country" value={form.country} onChange={set("country")} maxLength={120} className={field} /></div>
            <div className="space-y-2"><label className={label} htmlFor="p-headline">{isStaff ? "Professional title" : "Current role"}</label><Input id="p-headline" value={form.headline} onChange={set("headline")} placeholder={isStaff ? "e.g. Senior financial management tutor" : "e.g. Management accountant"} maxLength={160} className={field} /></div>
            <div className="space-y-2"><label className={label} htmlFor="p-employer">{isStaff ? "Organisation" : "Employer"}</label><Input id="p-employer" value={form.employer} onChange={set("employer")} maxLength={200} className={field} /></div>
            {!isStaff && <div className="space-y-2"><label className={label} htmlFor="p-target">Target qualification</label><Input id="p-target" value={form.targetQualification} onChange={set("targetQualification")} placeholder="e.g. CIMA Strategic Level" maxLength={200} className={field} /></div>}
            <div className="space-y-2"><label className={label} htmlFor="p-linkedin">LinkedIn (https://…)</label><Input id="p-linkedin" value={form.linkedinUrl} onChange={set("linkedinUrl")} placeholder="https://www.linkedin.com/in/…" maxLength={400} className={field} /></div>
          </div>

          <div className="space-y-2">
            <label className={label} htmlFor="p-bio">{isStaff ? "Bio" : "About me"}</label>
            <Textarea id="p-bio" value={form.bio} onChange={set("bio")} rows={5} maxLength={2000} placeholder={isStaff ? "Your experience, specialisms and how you support learners…" : "A few lines about your background and goals…"} className={field} />
            <p className="text-right text-[11px] text-white/40">{form.bio.length}/2000</p>
          </div>

          {!isStaff && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><label className={label} htmlFor="p-ec-name">Emergency contact</label><Input id="p-ec-name" value={form.emergencyContactName} onChange={set("emergencyContactName")} maxLength={200} className={field} /></div>
              <div className="space-y-2"><label className={label} htmlFor="p-ec-phone">Emergency contact phone</label><Input id="p-ec-phone" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} maxLength={40} className={field} /></div>
            </div>
          )}

          <div className="flex justify-end">
            <Button className="aft-button" disabled={update.isPending} onClick={() => update.mutate(toPayload(form))}>
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type FormState = Record<"name" | "phone" | "dateOfBirth" | "city" | "country" | "headline" | "employer" | "linkedinUrl" | "targetQualification" | "emergencyContactName" | "emergencyContactPhone" | "bio", string>;

function toForm(data: ProfileData): FormState {
  return {
    name: data.user.name ?? "",
    phone: data.profile.phone ?? "",
    dateOfBirth: data.profile.dateOfBirth ?? "",
    city: data.profile.city ?? "",
    country: data.profile.country ?? "",
    headline: data.profile.headline ?? "",
    employer: data.profile.employer ?? "",
    linkedinUrl: data.profile.linkedinUrl ?? "",
    targetQualification: data.profile.targetQualification ?? "",
    emergencyContactName: data.profile.emergencyContactName ?? "",
    emergencyContactPhone: data.profile.emergencyContactPhone ?? "",
    bio: data.profile.bio ?? "",
  };
}

function toPayload(form: FormState) {
  const blankToNull = (value: string) => (value.trim() ? value.trim() : null);
  return {
    name: form.name.trim(),
    phone: blankToNull(form.phone),
    dateOfBirth: blankToNull(form.dateOfBirth),
    city: blankToNull(form.city),
    country: blankToNull(form.country),
    headline: blankToNull(form.headline),
    employer: blankToNull(form.employer),
    linkedinUrl: blankToNull(form.linkedinUrl),
    targetQualification: blankToNull(form.targetQualification),
    emergencyContactName: blankToNull(form.emergencyContactName),
    emergencyContactPhone: blankToNull(form.emergencyContactPhone),
    bio: blankToNull(form.bio),
  };
}
