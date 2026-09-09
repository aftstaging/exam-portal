import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="nav-link flex items-center gap-1">
                  Shop <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="border-white/10 bg-[#120730] text-white">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-white focus:bg-[#14265b] focus:text-white">
                    Mock exams
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="border-white/10 bg-[#120730] text-white">
                    <DropdownMenuItem asChild>
                      <Link href="/mock-exams" className="w-full cursor-pointer text-white focus:bg-[#14265b] focus:text-white">
                        Case study exams
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/objective-tests" className="w-full cursor-pointer text-white focus:bg-[#14265b] focus:text-white">
                        Objective tests
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-white focus:bg-[#14265b] focus:text-white">
                    Other products
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="border-white/10 bg-[#120730] text-white">
                    <DropdownMenuItem asChild>
                      <Link href="/study-resources" className="w-full cursor-pointer text-white focus:bg-[#14265b] focus:text-white">
                        Study resources
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
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
