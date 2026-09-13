import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";

const logoUrl = "/assets/aft_logo_white.png";

export function PublicHeader({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      <div className="utility-bar">
        <div className="container flex items-center justify-end gap-6 text-[11px] font-semibold text-white/80">
          <span>Professional training. Clear and simple.</span>
          <span>South Africa</span>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-[#18093c]/95 backdrop-blur">
        <div className="container flex h-[76px] items-center justify-between gap-8">
          <Link href="/" className="shrink-0">
            <span className="inline-flex items-center">
              <img src={logoUrl} alt="Accountants for Tomorrow" className="h-10 w-auto object-contain" />
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-semibold text-white lg:flex">
            <Link href="/" className="nav-link">Home</Link>
            <Link href="/shop" className="nav-link">Shop</Link>
            <Link href="/mock-exams" className="nav-link">Mock exams</Link>
            <Link href="/dashboard" className="nav-link">My Account</Link>
            <Link href="/cart" className="nav-link">Cart</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden text-white sm:inline-flex" onClick={onLogin}>Log in</Button>
            <Button className="aft-button" onClick={() => startLogin()}>
              Create account <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
