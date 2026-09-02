import { ArrowRight, BookOpen, Clock3, FileText, Filter, PenLine, ShieldCheck, ShoppingBasket } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicHeader } from "@/components/PortalHeader";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { addToCart } from "@/pages/Cart";
import { useMemo, useState } from "react";

export default function Catalogue({ kind = "mock-exams" }: { kind?: "mock-exams" }) {
  void kind;
  const { isAuthenticated } = useAuth();
  const mocks = trpc.catalogue.mockExams.useQuery(undefined, { retry: false });
  const productsQuery = trpc.catalogue.products.useQuery(undefined, { retry: false });
  const [filter, setFilter] = useState("all");
  const exams = mocks.data ?? [];
  const products = productsQuery.data ?? [];
  const mockByProduct = useMemo(() => new Map(exams.map((item) => [item.product.id, item])), [exams]);
  const filters = ["all", "case_study", "objective_test", "marking"];
  const visibleProducts = useMemo(() => filter === "all" ? products.filter(({ product }) => ["case_study", "objective_test", "marking"].includes(product.category)) : products.filter(({ product }) => product.category === filter), [products, filter]);
  const imageByCategory: Record<string, string> = { case_study: "/assets/aft-strategy-feature.jpg", objective_test: "/assets/aft-management-feature.jpg", marking: "/assets/aft-certificate-feature.jpg", resource: "/assets/aft-operations-feature.jpg" };

  return <div className="min-h-screen bg-[#0c0524]">
    <PublicHeader onLogin={() => startLogin()} />
    <main className="container py-12 sm:py-16">
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#18093c] to-[#120730] p-7 sm:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="eyebrow">Accountants for Tomorrow · CIMA-informed practice · Exam store</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">Choose the practice product for your next milestone.</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#c4b5fd] sm:text-lg">Buy realistic case-study simulations, original AFT objective-test practice, or instructor marking. Every purchased exam product includes 30 days of access by default, subject to the access period set by an administrator.</p>
          </div>
          <div className="rounded-2xl border border-[#00e5ff]/30 bg-[#0c0524]/70 p-5">
            <div className="flex items-center gap-3 text-[#00e5ff]"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-bold">Secure, time-limited access</span></div>
            <p className="mt-3 text-sm leading-6 text-white/60">Products are linked to your learner account. Protected resources and exam actions close when access expires.</p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div><p className="eyebrow">Available products</p><h2 className="mt-2 text-2xl font-bold text-white">Mock exams, objective tests & marking</h2></div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#120730] px-3 py-2 text-sm text-[#c4b5fd]"><Filter className="h-4 w-4 text-[#00ff88]" /><span className="sr-only">Filter store products</span><select value={filter} onChange={(event) => setFilter(event.target.value)} className="bg-transparent text-sm font-semibold capitalize text-white outline-none">{filters.map((item) => <option key={item} value={item}>{item === "all" ? "All products" : item.replace("_", " ")}</option>)}</select></label>
        </div>

        {mocks.isLoading || productsQuery.isLoading ? <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl border border-white/10 bg-[#120730]" />)}</div> : visibleProducts.length === 0 ? <Card className="mt-8 border-[#00e5ff]/30 bg-[#120730]"><CardContent className="p-10 text-center"><ShoppingBasket className="mx-auto h-10 w-10 text-[#00e5ff]" /><h2 className="mt-5 text-xl font-bold text-white">No products match this filter</h2><p className="mt-2 text-sm text-[#c4b5fd]">Choose another store filter to view the available AFT practice products.</p></CardContent></Card> : <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{visibleProducts.map(({ product, qualification }) => {
          const linkedExam = mockByProduct.get(product.id);
          const isFree = product.priceCents === 0;
          const isMarking = product.category === "marking";
          const isObjective = product.category === "objective_test";
          const Icon = isMarking ? PenLine : isObjective ? BookOpen : FileText;
          const detailHref = linkedExam ? (isObjective ? `/objective-tests?mockExamId=${linkedExam.mockExam.id}&productId=${product.id}` : `/case-study/debrief?mockExamId=${linkedExam.mockExam.id}&productId=${product.id}`) : "/dashboard";
          const featuredImage = product.featuredImageUrl || imageByCategory[product.category] || imageByCategory.resource;
          return <Card key={product.id} className="group overflow-hidden border-white/10 bg-[#120730] transition duration-200 hover:-translate-y-1 hover:border-[#00e5ff]/50">
            <CardContent className="p-0"><div className="relative h-44 overflow-hidden"><img src={featuredImage} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#120730] via-transparent to-transparent" /></div><div className="p-6">
              <div className="flex items-start justify-between gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#102b36] text-[#00e5ff]"><Icon className="h-6 w-6" /></div><Badge className="bg-[#102b36] text-[#00ff88]">{isFree ? "Free sample" : "30-day access"}</Badge></div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#00ff88]">{qualification?.name ?? "AFT professional practice"}</p><p className="mt-2 text-xs font-bold uppercase tracking-[.16em] text-white/45">{product.category.replace("_", " ")}</p>
              <h3 className="mt-2 min-h-14 text-xl font-bold leading-7 text-white">{product.title}</h3>
              <p className="mt-3 min-h-20 text-sm leading-6 text-[#c4b5fd]">{product.description ?? (isMarking ? "Add instructor marking to an eligible case-study submission." : "Original AFT practice content with protected learner access.")}</p>
              <div className="mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-xs font-semibold text-white/55"><span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4 text-[#00ff88]" />{linkedExam ? `${Math.round(linkedExam.mockExam.totalDurationSeconds / 60)} minutes` : "30 days"}</span><span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-[#00e5ff]" />Account-linked</span></div>
              <div className="mt-6 flex items-center justify-between gap-3"><span className="text-lg font-black text-white">{isFree ? "Free" : `R${(product.priceCents / 100).toFixed(2)}`}</span><div className="flex items-center gap-3"><Link href={detailHref} className="text-sm font-bold text-[#00e5ff]">Details</Link>{isFree ? <Link href={detailHref}><Button size="sm" className="aft-button">Start exam</Button></Link> : <Button size="sm" className="aft-button" onClick={() => { addToCart(product.id); window.location.href = "/cart"; }}>Add to cart</Button>}</div>              </div>
            </div></CardContent>
          </Card>;
        })}</div>}
      </section>
    </main>
  </div>;
}
