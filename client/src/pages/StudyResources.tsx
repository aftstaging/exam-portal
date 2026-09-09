import { ArrowRight, BookOpen, Clock3, Download, FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicHeader } from "@/components/PortalHeader";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function StudyResources() {
  const { isAuthenticated } = useAuth();
  const productsQuery = trpc.catalogue.products.useQuery(undefined, { retry: false });
  const [filter, setFilter] = useState("all");
  const products = productsQuery.data ?? [];
  const imageByCategory: Record<string, string> = { case_study: "/assets/aft-strategy-feature.jpg", objective_test: "/assets/aft-management-feature.jpg", marking: "/assets/aft-certificate-feature.jpg", resource: "/assets/aft-operations-feature.jpg" };
  const filters = ["all", "resource", "marking"];
  const visibleProducts = useMemo(() => filter === "all" ? products.filter(({ product }) => ["resource", "marking"].includes(product.category)) : products.filter(({ product }) => product.category === filter), [products, filter]);

  return <div className="min-h-screen bg-[#0c0524]">
    <PublicHeader onLogin={() => startLogin()} />
    <main className="container py-12 sm:py-16">
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#18093c] to-[#120730] p-7 sm:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="eyebrow">Accountants for Tomorrow · CIMA-informed practice · Study resources</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">Focused resources for your next milestone.</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#c4b5fd] sm:text-lg">Pick up reference packs, marking support, and additional practice materials alongside your exam products.</p>
          </div>
          <div className="rounded-2xl border border-[#00e5ff]/30 bg-[#0c0524]/70 p-5">
            <div className="flex items-center gap-3 text-[#00e5ff]"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-bold">Secure, time-limited access</span></div>
            <p className="mt-3 text-sm leading-6 text-white/60">Protected resources are linked to your learner account after purchase.</p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div><p className="eyebrow">Available resources</p><h2 className="mt-2 text-2xl font-bold text-white">Study resources & marking</h2></div>
        </div>

        {productsQuery.isLoading ? <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl border border-white/10 bg-[#120730]" />)}</div> : visibleProducts.length === 0 ? <Card className="mt-8 border-[#00e5ff]/30 bg-[#120730]"><CardContent className="p-10 text-center"><BookOpen className="mx-auto h-10 w-10 text-[#00e5ff]" /><h2 className="mt-5 text-xl font-bold text-white">No resources available yet</h2><p className="mt-2 text-sm text-[#c4b5fd]">Study resources will appear here once an administrator publishes them.</p></CardContent></Card> : <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{visibleProducts.map(({ product, qualification }) => {
          const isFree = product.priceCents === 0;
          const isMarking = product.category === "marking";
          const Icon = isMarking ? FileText : BookOpen;
          const featuredImage = product.featuredImageUrl || imageByCategory[product.category] || imageByCategory.resource;
          return <Card key={product.id} className="group overflow-hidden border-white/10 bg-[#120730] transition duration-200 hover:-translate-y-1 hover:border-[#00e5ff]/50">
            <CardContent className="p-0"><div className="relative h-44 overflow-hidden"><img src={featuredImage} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#120730] via-transparent to-transparent" /></div><div className="p-6">
              <div className="flex items-start justify-between gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#102b36] text-[#00e5ff]"><Icon className="h-6 w-6" /></div><Badge className={`bg-[#102b36] text-[#00ff88]`}>{isFree ? "Free · Published" : "30-day access · Published"}</Badge></div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#00ff88]">{qualification?.name ?? "AFT professional practice"}</p><p className="mt-2 text-xs font-bold uppercase tracking-[.16em] text-white/45">{product.category === "resource" ? "Study resource" : "Instructor marking"}</p>
              <h3 className="mt-2 min-h-14 text-xl font-bold leading-7 text-white">{product.title}</h3>
              <p className="mt-3 min-h-20 text-sm leading-6 text-[#c4b5fd]">{product.description ?? "Original AFT practice content with protected learner access."}</p>
              <div className="mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-xs font-semibold text-white/55"><span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4 text-[#00ff88]" />30 days</span><span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-[#00e5ff]" />Account-linked</span></div>
              <div className="mt-6 flex items-center justify-between gap-3"><span className="text-lg font-black text-white">{isFree ? "Free" : `R${(product.priceCents / 100).toFixed(2)}`}</span><div className="flex items-center gap-3"><Link href={isAuthenticated ? "/dashboard" : "/cart"} className="text-sm font-bold text-[#00e5ff]">Details</Link>{isFree ? <Link href="/dashboard"><Button size="sm" className="aft-button"><Download className="mr-1.5 h-4 w-4" />Access</Button></Link> : <Link href="/cart"><Button size="sm" className="aft-button">Add to cart <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>}</div></div>
            </div></CardContent>
          </Card>;
        })}</div>}
      </section>
    </main>
  </div>;
}