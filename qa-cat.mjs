const TITLE = "QA Cat Test " + Date.now();

export default async function run(page, ui) {
  const quiet = (r) => (typeof r === "string" ? r.slice(0, 400) : JSON.stringify(r).slice(0, 400));

  const login = await page.evaluate(async () => {
    const res = await fetch("/api/trpc/auth.login?batch=1", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "0": { json: { email: "demo.admin@accountantsfortomorrow.co.za", password: "AdminDemo!2026" } } }),
    });
    return { status: res.status, body: (await res.text()).slice(0, 300) };
  });

  const readCatalogue = async (label) => {
    const data = await page.evaluate(async () => {
      const raw = await fetch("/api/trpc/catalogue.products?batch=1&" + Date.now()).then((r) => r.json());
      const items = raw["0"]?.result?.data?.json ?? raw["0"]?.result?.data ?? [];
      const mraw = await fetch("/api/trpc/catalogue.mockExams?batch=1&" + Date.now()).then((r) => r.json());
      const mitems = mraw["0"]?.result?.data?.json ?? mraw["0"]?.result?.data ?? [];
      return {
        products: items.map((x) => ({ id: x.product.id, title: x.product.title, status: x.product.status })),
        mockExams: mitems.map((x) => ({ id: x.mockExam.id, productId: x.product.id, title: x.mockExam.title, status: x.mockExam.status })),
      };
    });
    return { label, ...data };
  };

  const before = await readCatalogue("beforeLogin");

  const create = await page.evaluate(async (title) => {
    const payload = {
      title,
      examType: "objective_test",
      intro: "QA auto-created objective test",
      priceCents: 5000,
      accessDays: 30,
      totalDurationSeconds: 1800,
      objectiveQuestions: [
        { topic: "Budgetary control", prompt: "What is a budget?", questionType: "single_choice", options: ["A plan", "A party"], correct: 0, explanation: "A budget is a plan." },
      ],
    };
    const res = await fetch("/api/trpc/admin.createExamBundle?batch=1", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "0": { json: payload } }),
    });
    const body = await res.text();
    return { status: res.status, body: body.slice(0, 500) };
  }, TITLE);

  let mockExamId = null;
  let productId = null;
  try {
    const data = JSON.parse(create.body);
    mockExamId = data["0"]?.result?.data?.json?.mockExamId ?? data["0"]?.result?.data?.mockExamId;
    productId = data["0"]?.result?.data?.json?.productId ?? data["0"]?.result?.data?.productId;
  } catch { /* ignore */ }

  const publish = await page.evaluate(async (pid) => {
    const res = await fetch("/api/trpc/admin.updateProductStatus?batch=1", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ "0": { json: { productId: pid, status: "published" } } }),
    });
    const body = await res.text();
    let result;
    try { result = JSON.parse(body); } catch { result = body.slice(0, 300); }
    return { status: res.status, result };
  }, productId);

  const after = await readCatalogue("afterPublish");

  const content = await page.evaluate(async (id) => {
    const raw = await fetch("/api/trpc/admin.contentItems?batch=1&input=" + encodeURIComponent(JSON.stringify({ "0": { json: { kind: "mock_exams" } } }))).then((r) => r.json());
    const items = raw["0"]?.result?.data?.json ?? raw["0"]?.result?.data ?? [];
    return items.filter((x) => x.id === id).map((x) => ({ id: x.id, title: x.title, detail: x.detail, status: x.status }));
  }, mockExamId);

  return { TITLE, login, create, mockExamId, productId, publish, before, after, content };
}