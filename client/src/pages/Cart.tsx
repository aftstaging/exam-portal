import { ArrowLeft, Check, CreditCard, ShoppingCart, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PublicHeader } from "@/components/PortalHeader";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

const CART_KEY = "aft-cart-product-ids";
export function addToCart(productId: number) {
  const current = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as number[];
  window.localStorage.setItem(CART_KEY, JSON.stringify(Array.from(new Set([...current, productId]))));
}

export default function Cart() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const productsQuery = trpc.catalogue.products.useQuery(undefined, { retry: false });
  const checkout = trpc.payments.createPayfastCartCheckout.useMutation({
    onSuccess: ({ endpoint, fields }) => {
      const form = document.createElement("form"); form.method = "POST"; form.action = endpoint;
      Object.entries(fields).forEach(([name, value]) => { const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.appendChild(input); });
      document.body.appendChild(form); form.submit();
    },
    onError: (error) => window.alert(error.message),
  });
  const claimFree = trpc.payments.claimFreeProduct.useMutation({ onError: (error) => window.alert(error.message) });
  const [cartIds, setCartIds] = useState<number[]>(() => { try { return JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as number[]; } catch { return []; } });
  useEffect(() => { window.localStorage.setItem(CART_KEY, JSON.stringify(cartIds)); }, [cartIds]);
  const items = useMemo(() => (productsQuery.data ?? []).filter(({ product }) => cartIds.includes(product.id)), [productsQuery.data, cartIds]);
  const paidIds = items.filter(({ product }) => product.priceCents > 0).map(({ product }) => product.id);
  const freeIds = items.filter(({ product }) => product.priceCents === 0).map(({ product }) => product.id);
  const total = items.reduce((sum, { product }) => sum + product.priceCents, 0);
  const clearCart = () => setCartIds([]);
  const remove = (productId: number) => setCartIds((current) => current.filter((id) => id !== productId));
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<null | { code: string; discountCents: number }>(null);
  const validateCoupon = trpc.payments.validateCoupon.useMutation({
    onSuccess: (data) => { setAppliedCoupon({ code: data.code, discountCents: data.discountCents }); },
    onError: (error) => { window.alert(error.message); setAppliedCoupon(null); },
  });
  const couponDiscountCents = paidIds.length ? (appliedCoupon?.discountCents ?? 0) : 0;
  const payable = Math.max(0, total - couponDiscountCents);
  const applyCoupon = () => {
    if (!couponCodeInput.trim()) return;
    if (!isAuthenticated) { startLogin(); return; }
    validateCoupon.mutate({ code: couponCodeInput.trim(), subtotalCents: total });
  };
  const checkoutCart = async () => {
    if (!isAuthenticated) { startLogin(); return; }
    if (freeIds.length) await Promise.all(freeIds.map((productId) => claimFree.mutateAsync({ productId })));
    if (paidIds.length) checkout.mutate({ productIds: paidIds, couponCode: appliedCoupon?.code }); else { clearCart(); navigate("/dashboard"); }
  };
  return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin()} /><main className="container py-12 sm:py-16"><div className="mx-auto max-w-5xl"><Link href="/mock-exams" className="inline-flex items-center gap-2 text-sm font-bold text-[#00e5ff]"><ArrowLeft className="h-4 w-4" /> Continue shopping</Link><div className="mt-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Learner cart</p><h1 className="mt-2 text-4xl font-black text-white">Your exam basket</h1><p className="mt-3 text-[#c4b5fd]">Choose the exam products you need, then check out once. Free objective tests are enrolled immediately after sign-in.</p></div><Badge className="bg-[#102b36] text-[#00ff88]">{items.length} item{items.length === 1 ? "" : "s"}</Badge></div>{items.length === 0 ? <Card className="mt-8 border-[#00e5ff]/30 bg-[#120730]"><CardContent className="p-12 text-center"><ShoppingCart className="mx-auto h-10 w-10 text-[#00e5ff]" /><h2 className="mt-5 text-2xl font-bold text-white">Your cart is empty</h2><p className="mt-2 text-[#c4b5fd]">Add case-study exams, objective tests, or instructor marking from the store.</p><Link href="/mock-exams"><Button className="aft-button mt-6">Browse the store</Button></Link></CardContent></Card> : <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]"><Card className="border-white/10 bg-[#120730]"><CardHeader><CardTitle className="text-white">Selected products</CardTitle></CardHeader><CardContent className="space-y-3">{items.map(({ product }) => <div key={product.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 p-4"><div className="min-w-0"><div className="font-bold text-white">{product.title}</div><div className="mt-1 text-sm capitalize text-[#c4b5fd]">{product.category.replace("_", " ")} · {product.priceCents === 0 ? "Free" : `R${(product.priceCents / 100).toFixed(2)}`} · {product.accessDays} days access</div></div><Button variant="ghost" size="sm" className="text-white/60 hover:text-white" onClick={() => remove(product.id)} aria-label={`Remove ${product.title}`}><Trash2 className="h-4 w-4" /></Button></div>)}<Button variant="ghost" className="text-white/60" onClick={clearCart}>Clear cart</Button></CardContent></Card><Card className="h-fit border-[#00e5ff]/30 bg-[#120730]"><CardHeader><CardTitle className="text-white">Order summary</CardTitle></CardHeader><CardContent><div className="flex justify-between text-sm text-[#c4b5fd]"><span>Products</span><span>{items.length}</span></div>{paidIds.length > 0 && <div className="mt-3 rounded-xl border border-white/10 bg-[#0c0524]/60 p-3"><div className="flex gap-2"><Input value={couponCodeInput} onChange={(e) => setCouponCodeInput(e.target.value)} placeholder="Coupon code" className="h-9 border-white/10 bg-[#0c0524] text-white" /><Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={applyCoupon} disabled={validateCoupon.isPending || Boolean(appliedCoupon)}>{appliedCoupon ? "Applied" : validateCoupon.isPending ? "Applying..." : "Apply"}</Button></div>{appliedCoupon && <div className="mt-2 flex justify-between text-sm text-[#00ff88]"><span>Coupon {appliedCoupon.code}</span><span>-R{(couponDiscountCents / 100).toFixed(2)}</span></div>}</div>}<div className="mt-3 flex justify-between border-t border-white/10 pt-4 text-lg font-black text-white"><span>Total</span><span>{payable === 0 ? "Free" : `R${(payable / 100).toFixed(2)}`}</span></div><p className="mt-4 text-xs leading-5 text-white/50">Access starts after successful enrollment or verified payment and expires according to each product’s admin-controlled access period.</p><Button className="aft-button mt-6 w-full" disabled={checkout.isPending || claimFree.isPending} onClick={checkoutCart}>{checkout.isPending || claimFree.isPending ? "Processing…" : total === 0 ? "Add free access" : <><CreditCard className="mr-2 h-4 w-4" />Checkout</>}</Button>{freeIds.length > 0 && <div className="mt-4 flex items-center gap-2 text-xs text-[#00ff88]"><Check className="h-4 w-4" />{freeIds.length} free product{freeIds.length === 1 ? "" : "s"} included</div>}</CardContent></Card></div>}</div></main></div>;
}
