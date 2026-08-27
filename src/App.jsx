import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import {
  LayoutDashboard, Receipt, Package, FileText, Plus, Trash2,
  Search, X, Printer, AlertTriangle, ArrowRight, Pencil, Users,
  Truck, CalendarClock, BarChart3, Settings as SettingsIcon, Download, ShieldAlert, Building2
} from "lucide-react";

const KEYS = {
  products: "spark-billing-products",
  customers: "spark-billing-customers",
  quotations: "spark-billing-quotations",
  invoices: "spark-billing-invoices",
  stockins: "spark-billing-stockins",
  advance: "spark-billing-advance",
  settings: "spark-billing-settings",
  units: "spark-billing-units",
  agents: "spark-billing-agents",
  companies: "spark-billing-companies",
  users: "spark-billing-users",
};

// Indian financial year label, e.g. "26-27" for FY starting Apr 2026
function fyLabel() {
  const d = new Date();
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // FY starts April
  return `${(startYear % 100).toString().padStart(2, "0")}-${((startYear + 1) % 100).toString().padStart(2, "0")}`;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmt = (n) => "\u20B9" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
// Amount = case qty * case content * price (buying full cases)
// Amount = subunit qty * price (buying loose subunits, e.g. vandal)
const lineTotal = (item) =>
  item.mode === "case" ? item.qty * (item.caseContent || 1) * item.price : item.qty * item.price;
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(todayStr());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const CATEGORY_DEFAULT = "General";

const DEFAULT_UNITS = ["Case", "Unit", "Pit", "Pcs", "Box", "Vandal", "Bundle", "PKT"];

const seedProducts = [
  { id: uid(), name: "Sky Shot 10 Wala", category: "Sky Shots", subunit: "Pcs", caseContent: 10, sku: "SS-010", wholesalePrice: 42, retailPrice: 55, costPrice: 34, stock: 600, lowStock: 100 },
  { id: uid(), name: "Ground Chakkar Big", category: "Chakkar", subunit: "Pcs", caseContent: 5, sku: "CK-005", wholesalePrice: 36, retailPrice: 50, costPrice: 28, stock: 225, lowStock: 40 },
  { id: uid(), name: "Flower Pot Deluxe", category: "Flower Pots", subunit: "Pcs", caseContent: 10, sku: "FP-010", wholesalePrice: 32, retailPrice: 42, costPrice: 25, stock: 80, lowStock: 100 },
  { id: uid(), name: "Sparklers 7 inch", category: "Sparklers", subunit: "Box", caseContent: 10, sku: "SP-710", wholesalePrice: 14, retailPrice: 19, costPrice: 10.5, stock: 1000, lowStock: 150 },
  { id: uid(), name: "Bijili 1000 Wala", category: "Bijili", subunit: "Vandal", caseContent: 1, sku: "BJ-1000", wholesalePrice: 260, retailPrice: 340, costPrice: 195, stock: 5, lowStock: 10 },
  { id: uid(), name: "Family Gift Box", category: "Gift Box", subunit: "Box", caseContent: 1, sku: "GB-001", wholesalePrice: 950, retailPrice: 1250, costPrice: 720, stock: 20, lowStock: 5 },
];

const defaultSettings = {
  businessName: "Sparkline Traders",
  tagline: "Sivakasi's finest fireworks",
  address: "Sivakasi, Tamil Nadu",
  phone: "",
  email: "",
  website: "",
  gstEnabled: true,
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,
  licenseNumber: "",
  licenseExpiry: "",
  seasonalMode: false,
  quoteCounter: 0,
  invoiceCounter: 0,
};

function downloadXlsx(rows, filename, sheetName) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Sheet1");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [ready, setReady] = useState(false);

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [stockins, setStockins] = useState([]);
  const [advanceOrders, setAdvanceOrders] = useState([]);
  const [units, setUnits] = useState([]);
  const [agents, setAgents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);

  const [editingName, setEditingName] = useState(false);

  const [cart, setCart] = useState([]);
  const [customerType, setCustomerType] = useState("wholesale");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPlace, setCustomerPlace] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [taxType, setTaxType] = useState("intra");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewQuotation, setViewQuotation] = useState(null);

  useEffect(() => {
    (async () => {
      const load = async (key, fallback) => {
        try {
          const r = await window.storage.get(key);
          if (r && r.value) return JSON.parse(r.value);
        } catch (e) {}
        return fallback;
      };
      setProducts(await load(KEYS.products, seedProducts));
      setCustomers(await load(KEYS.customers, []));
      setQuotations(await load(KEYS.quotations, []));
      setInvoices(await load(KEYS.invoices, []));
      setStockins(await load(KEYS.stockins, []));
      setAdvanceOrders(await load(KEYS.advance, []));
      setUnits(await load(KEYS.units, DEFAULT_UNITS));
      setAgents(await load(KEYS.agents, []));
      setCompanies(await load(KEYS.companies, []));
      setUsers(await load(KEYS.users, []));
      setSettings(await load(KEYS.settings, defaultSettings));
      setReady(true);
    })();
  }, []);

  async function persist(key, setter, next) {
    setter(next);
    try { await window.storage.set(key, JSON.stringify(next)); } catch (e) {}
  }
  const persistProducts = (next) => persist(KEYS.products, setProducts, next);
  const persistCustomers = (next) => persist(KEYS.customers, setCustomers, next);
  const persistQuotations = (next) => persist(KEYS.quotations, setQuotations, next);
  const persistInvoices = (next) => persist(KEYS.invoices, setInvoices, next);
  const persistStockins = (next) => persist(KEYS.stockins, setStockins, next);
  const persistAdvance = (next) => persist(KEYS.advance, setAdvanceOrders, next);
  const persistUnits = (next) => persist(KEYS.units, setUnits, next);
  const persistAgents = (next) => persist(KEYS.agents, setAgents, next);
  const persistSettings = (next) => persist(KEYS.settings, setSettings, next);

  function addUnit(name) {
    const trimmed = name.trim();
    if (!trimmed || units.includes(trimmed)) return;
    persistUnits([...units, trimmed]);
  }
  function deleteUnit(name) { persistUnits(units.filter((u) => u !== name)); }

  function addAgent(agent) { persistAgents([{ ...agent, id: uid() }, ...agents]); }
  function deleteAgent(id) { persistAgents(agents.filter((a) => a.id !== id)); }

  const persistCompaniesFn = (next) => persist(KEYS.companies, setCompanies, next);
  const persistUsersFn = (next) => persist(KEYS.users, setUsers, next);

  function addCompany(company) { persistCompaniesFn([{ ...company, id: uid() }, ...companies]); }
  function updateCompany(id, patch) { persistCompaniesFn(companies.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function deleteCompany(id) { persistCompaniesFn(companies.filter((c) => c.id !== id)); }

  function addUser(user) { persistUsersFn([{ ...user, id: uid() }, ...users]); }
  function deleteUser(id) { persistUsersFn(users.filter((u) => u.id !== id)); }

  function switchCompany(companyId) {
    const c = companies.find((x) => x.id === companyId);
    if (!c) return;
    const next = {
      ...settings, businessName: c.name, tagline: c.tagline || settings.tagline,
      address: c.address || settings.address, phone: c.phone || settings.phone,
      email: c.email || settings.email, website: c.website || settings.website,
      activeCompanyId: c.id,
    };
    persistSettings(next);
  }

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    );
  }, [products, productQuery]);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      const price = customerType === "wholesale" ? product.wholesalePrice : product.retailPrice;
      if (existing) return prev.map((c) => (c.productId === product.id ? { ...c, qty: c.qty + 1 } : c));
      return [
        ...prev,
        {
          productId: product.id, name: product.name, subunit: product.subunit || "Pcs",
          caseContent: product.caseContent || 1, mode: "case", qty: 1, price, costPrice: product.costPrice || 0,
        },
      ];
    });
  }
  function updateCartQty(productId, qty) {
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, qty: Math.max(1, qty) } : c)));
  }
  function updateCartMode(productId, mode) {
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, mode } : c)));
  }
  function updateCartPrice(productId, price) {
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, price: Math.max(0, price) } : c)));
  }
  function removeFromCart(productId) {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }

  useEffect(() => {
    setCart((prev) =>
      prev.map((c) => {
        const prod = products.find((p) => p.id === c.productId);
        if (!prod) return c;
        return { ...c, price: customerType === "wholesale" ? prod.wholesalePrice : prod.retailPrice };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerType]);

  const subtotal = cart.reduce((s, c) => s + lineTotal(c), 0);
  const discountAmt = (subtotal * (Number(discountPct) || 0)) / 100;
  const taxable = Math.max(0, subtotal - discountAmt);
  const cgstAmt = settings.gstEnabled && taxType === "intra" ? (taxable * (Number(settings.cgstRate) || 0)) / 100 : 0;
  const sgstAmt = settings.gstEnabled && taxType === "intra" ? (taxable * (Number(settings.sgstRate) || 0)) / 100 : 0;
  const igstAmt = settings.gstEnabled && taxType === "inter" ? (taxable * (Number(settings.igstRate) || 0)) / 100 : 0;
  const grandTotal = taxable + cgstAmt + sgstAmt + igstAmt;

  function nextQuoteNo() {
    const n = (settings.quoteCounter || 0) + 1;
    return { no: `${n.toString().padStart(3, "0")}/QUT${fyLabel()}`, counter: n };
  }
  function nextEstimateNo() {
    const n = (settings.invoiceCounter || 0) + 1;
    return { no: `${n.toString().padStart(3, "0")}/INV${fyLabel()}`, counter: n };
  }
  function resetCounter(type) {
    const patch = type === "quote" ? { quoteCounter: 0 } : { invoiceCounter: 0 };
    const next = { ...settings, ...patch };
    persistSettings(next);
  }

  async function saveQuotation() {
    if (cart.length === 0) return;
    const { no, counter } = nextQuoteNo();
    const name = customerName.trim() || "Walk-in customer";
    const phone = customerPhone.trim();
    const place = customerPlace.trim();
    const agent = agents.find((a) => a.id === selectedAgentId);

    const quotation = {
      id: uid(),
      quoteNo: no,
      date: todayStr(),
      customerName: name,
      customerPhone: phone,
      customerPlace: place,
      customerType,
      agentId: agent ? agent.id : null,
      agentName: agent ? agent.name : "",
      items: cart.map((c) => ({
        productId: c.productId, name: c.name, subunit: c.subunit, caseContent: c.caseContent, mode: c.mode,
        qty: c.qty, price: c.price, costPrice: c.costPrice || 0, total: lineTotal(c),
      })),
      discountPct: Number(discountPct) || 0,
      subtotal, discountAmt,
      gstEnabled: settings.gstEnabled, taxType, cgstRate: settings.cgstRate, sgstRate: settings.sgstRate, igstRate: settings.igstRate,
      cgstAmt, sgstAmt, igstAmt,
      total: grandTotal,
      status: "pending",
      invoiceId: null,
      docType: "Original",
    };
    await persistQuotations([quotation, ...quotations]);
    await persistSettings({ ...settings, quoteCounter: counter });

    setCart([]); setCustomerName(""); setCustomerPhone(""); setCustomerPlace(""); setDiscountPct(0); setSelectedAgentId("");
    setViewQuotation(quotation);
  }

  async function convertQuotationToEstimate(quotation, payMode, amountPaidVal) {
    const { no, counter } = nextEstimateNo();
    const total = quotation.total;
    const paid = amountPaidVal === "" || amountPaidVal == null ? total : Number(amountPaidVal) || 0;
    const due = Math.max(0, total - paid);

    let custId = null;
    let nextCustomers = customers;
    if (quotation.customerPhone) {
      const existing = customers.find((c) => c.phone === quotation.customerPhone);
      if (existing) {
        custId = existing.id;
        nextCustomers = customers.map((c) => (c.id === existing.id ? { ...c, balanceDue: (c.balanceDue || 0) + due, type: quotation.customerType, location: quotation.customerPlace || c.location } : c));
      } else {
        custId = uid();
        nextCustomers = [...customers, { id: custId, name: quotation.customerName, phone: quotation.customerPhone, address: "", location: quotation.customerPlace || "", identType: "GSTIN", identValue: "", type: quotation.customerType, balanceDue: due }];
      }
      await persistCustomers(nextCustomers);
    }

    const invoice = {
      id: uid(), invoiceNo: no, date: todayStr(), customerId: custId,
      customerName: quotation.customerName, customerPhone: quotation.customerPhone, customerPlace: quotation.customerPlace || "", customerType: quotation.customerType,
      agentId: quotation.agentId || null, agentName: quotation.agentName || "",
      items: quotation.items, discountPct: quotation.discountPct, subtotal: quotation.subtotal, discountAmt: quotation.discountAmt,
      gstEnabled: quotation.gstEnabled, taxType: quotation.taxType, cgstRate: quotation.cgstRate, sgstRate: quotation.sgstRate, igstRate: quotation.igstRate,
      cgstAmt: quotation.cgstAmt, sgstAmt: quotation.sgstAmt, igstAmt: quotation.igstAmt || 0,
      total, paymentMode: payMode, amountPaid: paid, balanceDue: due,
      quoteNo: quotation.quoteNo, returns: [], docType: "Original",
    };
    await persistInvoices([invoice, ...invoices]);
    await persistSettings({ ...settings, invoiceCounter: counter });

    const nextProducts = products.map((p) => {
      const item = quotation.items.find((i) => i.productId === p.id);
      if (!item) return p;
      const subunitsSold = item.mode === "case" ? item.qty * (item.caseContent || 1) : item.qty;
      return { ...p, stock: Math.max(0, p.stock - subunitsSold) };
    });
    await persistProducts(nextProducts);

    await persistQuotations(quotations.map((q) => (q.id === quotation.id ? { ...q, status: "converted", invoiceId: invoice.id } : q)));
    setViewInvoice(invoice);
  }

  async function returnFromInvoice(invoice, returnItems) {
    const returnedValue = returnItems.reduce((s, r) => {
      const item = invoice.items[r.idx];
      const unitTotal = item.mode === "case" ? item.price * (item.caseContent || 1) : item.price;
      return s + r.qty * unitTotal;
    }, 0);
    if (returnedValue <= 0) return;

    const nextProducts = products.map((p) => {
      const match = returnItems.find((r) => invoice.items[r.idx].productId === p.id);
      if (!match) return p;
      const item = invoice.items[match.idx];
      const subunitsBack = item.mode === "case" ? match.qty * (item.caseContent || 1) : match.qty;
      return { ...p, stock: p.stock + subunitsBack };
    });
    await persistProducts(nextProducts);

    const newBalanceDue = Math.max(0, (invoice.balanceDue || 0) - returnedValue);
    const nextInvoice = {
      ...invoice,
      total: Math.max(0, invoice.total - returnedValue),
      balanceDue: newBalanceDue,
      returns: [...(invoice.returns || []), { date: todayStr(), items: returnItems.map((r) => ({ name: invoice.items[r.idx].name, qty: r.qty })), value: returnedValue }],
    };
    await persistInvoices(invoices.map((i) => (i.id === invoice.id ? nextInvoice : i)));

    if (invoice.customerId) {
      persistCustomers(customers.map((c) => (c.id === invoice.customerId ? { ...c, balanceDue: Math.max(0, (c.balanceDue || 0) - Math.min(returnedValue, invoice.balanceDue || 0)) } : c)));
    }
    setViewInvoice(nextInvoice);
  }

  function deleteQuotation(id) { persistQuotations(quotations.filter((q) => q.id !== id)); }

  function addProduct(product) {
    const withId = { ...product, id: uid() };
    persistProducts([...products, withId]);
    return withId;
  }
  function updateProduct(id, patch) { persistProducts(products.map((p) => (p.id === id ? { ...p, ...patch } : p))); }
  function deleteProduct(id) { persistProducts(products.filter((p) => p.id !== id)); }

  function recordCustomerPayment(id, amount) {
    persistCustomers(customers.map((c) => (c.id === id ? { ...c, balanceDue: Math.max(0, (c.balanceDue || 0) - amount) } : c)));
  }
  function deleteCustomer(id) { persistCustomers(customers.filter((c) => c.id !== id)); }

  async function addStockIn(entry) {
    const record = { ...entry, id: uid(), date: entry.date || todayStr() };
    await persistStockins([record, ...stockins]);
    const nextProducts = products.map((p) => {
      const item = entry.items.find((i) => i.productId === p.id);
      if (!item) return p;
      return { ...p, stock: p.stock + item.qty, costPrice: item.costPrice };
    });
    await persistProducts(nextProducts);
  }

  function addAdvanceOrder(order) { persistAdvance([{ ...order, id: uid(), status: "pending" }, ...advanceOrders]); }
  function updateAdvanceStatus(id, status) { persistAdvance(advanceOrders.map((o) => (o.id === id ? { ...o, status } : o))); }
  function deleteAdvanceOrder(id) { persistAdvance(advanceOrders.filter((o) => o.id !== id)); }

  const lowStockItems = products.filter((p) => p.stock <= p.lowStock);
  const totalQuotationAmount = quotations.reduce((s, q) => s + q.total, 0);
  const totalSalesAmount = invoices.reduce((s, i) => s + i.total, 0);
  const todayRevenue = invoices.filter((i) => i.date === todayStr()).reduce((s, i) => s + i.total, 0);
  const wholesaleRevenue = invoices.filter((i) => i.customerType === "wholesale").reduce((s, i) => s + i.total, 0);
  const retailRevenue = invoices.filter((i) => i.customerType === "retail").reduce((s, i) => s + i.total, 0);
  const totalCreditDue = customers.reduce((s, c) => s + (c.balanceDue || 0), 0);
  const licenseDays = daysUntil(settings.licenseExpiry);

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-IN", { weekday: "short" });
      const dayInvoices = invoices.filter((inv) => inv.date === key);
      const wholesale = dayInvoices.filter((i2) => i2.customerType === "wholesale").reduce((s, i2) => s + i2.total, 0);
      const retail = dayInvoices.filter((i2) => i2.customerType === "retail").reduce((s, i2) => s + i2.total, 0);
      days.push({ label, wholesale, retail });
    }
    return days;
  }, [invoices]);

  if (!ready) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "#6B6258", fontFamily: "Inter, sans-serif" }}>Loading billing dashboard...</div>;
  }

  return (
    <div className="app-root">
      <style>{globalStyles}</style>

      <div className="sidebar">
        <div className="brand-row">
          <div className="brand-mark" />
          <div className="brand-name disp" onClick={() => setEditingName(true)} style={{ cursor: "pointer" }}>
            {editingName ? (
              <input autoFocus value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                onBlur={() => { setEditingName(false); persistSettings(settings); }}
                onKeyDown={(e) => e.key === "Enter" && (setEditingName(false), persistSettings(settings))}
                style={{ fontSize: 14, padding: "4px 6px", width: 140 }} />
            ) : settings.businessName}
          </div>
        </div>
        {[
          ["dashboard", "Dashboard", LayoutDashboard],
          ["companies", "Companies", Building2],
          ["users", "Users", Users],
          ["bill", "New quotation", Receipt],
          ["quotations", "Quotations", FileText],
          ["customers", "Customers", Users],
          ["agents", "Agents", Users],
          ["products", "Products & stock", Package],
          ["units", "Units", Package],
          ["purchases", "Purchases", Truck],
          ["advance", "Advance orders", CalendarClock],
          ["invoices", "Estimates (sales)", FileText],
          ["reports", "Reports", BarChart3],
          ["settings", "Settings", SettingsIcon],
        ].map(([key, label, Icon]) => (
          <button key={key} className={`navbtn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="main">
        {licenseDays !== null && licenseDays <= 30 && (
          <div className={`licensebanner ${licenseDays < 0 ? "expired" : ""}`}>
            <ShieldAlert size={15} />
            {licenseDays < 0
              ? `License expired ${Math.abs(licenseDays)} days ago. Renew it in Settings.`
              : `License expires in ${licenseDays} days. Renew it in Settings.`}
          </div>
        )}

        {tab === "dashboard" && (
          <DashboardTab {...{ totalQuotationAmount, totalSalesAmount, todayRevenue, wholesaleRevenue, retailRevenue, lowStockItems, invoices, chartData, setViewInvoice, totalCreditDue, companies, settings, switchCompany }} />
        )}
        {tab === "companies" && (
          <CompaniesTab {...{ companies, addCompany, updateCompany, deleteCompany }} />
        )}
        {tab === "users" && (
          <UsersTab {...{ users, addUser, deleteUser }} />
        )}
        {tab === "bill" && (
          <BillTab {...{
            products: filteredProducts, productQuery, setProductQuery, cart, addToCart, updateCartQty, updateCartMode, updateCartPrice, removeFromCart,
            customerType, setCustomerType, customerName, setCustomerName, customerPhone, setCustomerPhone, customerPlace, setCustomerPlace, customers,
            discountPct, setDiscountPct, subtotal, discountAmt, taxable, cgstAmt, sgstAmt, igstAmt, taxType, setTaxType,
            grandTotal, saveQuotation, settings, agents, selectedAgentId, setSelectedAgentId, addProduct, units,
          }} />
        )}
        {tab === "quotations" && (
          <QuotationsTab {...{ quotations, convertQuotationToEstimate, deleteQuotation, setViewQuotation }} />
        )}
        {tab === "customers" && (
          <CustomersTab {...{ customers, invoices, recordCustomerPayment, deleteCustomer, updateCustomer: persistCustomers }} />
        )}
        {tab === "agents" && (
          <AgentsTab {...{ agents, addAgent, deleteAgent }} />
        )}
        {tab === "products" && (
          <ProductsTab {...{ products, addProduct, updateProduct, deleteProduct, units }} />
        )}
        {tab === "units" && (
          <UnitsTab {...{ units, addUnit, deleteUnit }} />
        )}
        {tab === "purchases" && (
          <PurchasesTab {...{ products, stockins, addStockIn }} />
        )}
        {tab === "advance" && (
          <AdvanceOrdersTab {...{ products, advanceOrders, addAdvanceOrder, updateAdvanceStatus, deleteAdvanceOrder }} />
        )}
        {tab === "invoices" && (
          <InvoicesTab {...{ invoices, setViewInvoice, returnFromInvoice }} />
        )}
        {tab === "reports" && (
          <ReportsTab {...{ invoices, products }} />
        )}
        {tab === "settings" && (
          <SettingsTab {...{ settings, setSettings, persistSettings, resetCounter }} />
        )}
      </div>

      {viewInvoice && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="modal-backdrop" style={{ position: "fixed", inset: 0, minHeight: "auto" }}>
            <ReceiptCard doc={viewInvoice} kind="estimate" settings={settings} onClose={() => setViewInvoice(null)} />
          </div>
        </div>
      )}
      {viewQuotation && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="modal-backdrop" style={{ position: "fixed", inset: 0, minHeight: "auto" }}>
            <ReceiptCard doc={viewQuotation} kind="quotation" settings={settings} onClose={() => setViewQuotation(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardTab({ totalQuotationAmount, totalSalesAmount, todayRevenue, wholesaleRevenue, retailRevenue, lowStockItems, invoices, chartData, setViewInvoice, totalCreditDue, companies, settings, switchCompany }) {
  const [pickedCompany, setPickedCompany] = useState(settings.activeCompanyId || "");

  const salesBySubunit = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => inv.items.forEach((it) => {
      const key = it.subunit || "Pcs";
      if (!map[key]) map[key] = { subunit: key, caseQty: 0, subunitQty: 0, revenue: 0 };
      if (it.mode === "case") map[key].caseQty += it.qty; else map[key].subunitQty += it.qty;
      map[key].revenue += it.total;
    }));
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [invoices]);

  const salesByParty = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => { map[inv.customerName] = (map[inv.customerName] || 0) + inv.total; });
    return Object.entries(map).map(([party, amount]) => ({ party, amount })).sort((a, b) => b.amount - a.amount);
  }, [invoices]);

  return (
    <>
      <div className="topbar">
        <div className="pagetitle disp">Dashboard</div>
        <div className="datepill">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
      </div>

      {companies.length > 0 && (
        <div className="panel">
          <h3>Bill Company</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select style={{ maxWidth: 280 }} value={pickedCompany} onChange={(e) => setPickedCompany(e.target.value)}>
              <option value="">Select company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="primarybtn" style={{ width: "auto", padding: "9px 20px" }} disabled={!pickedCompany} onClick={() => switchCompany(pickedCompany)}>Submit</button>
          </div>
          {settings.activeCompanyId && (
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 8 }}>
              Currently billing as <strong>{settings.businessName}</strong> — this name appears on all printed quotations and estimates.
            </div>
          )}
        </div>
      )}

      <div className="cardrow cardrow-5">
        <div className="metric"><div className="label">Total quotation amount</div><div className="value mono">{fmt(totalQuotationAmount)}</div></div>
        <div className="metric"><div className="label">Total sales amount</div><div className="value mono">{fmt(totalSalesAmount)}</div></div>
        <div className="metric"><div className="label">Today's sales</div><div className="value mono">{fmt(todayRevenue)}</div></div>
        <div className="metric"><div className="label">Wholesale / retail</div>
          <div className="value mono" style={{ fontSize: 15 }}>{fmt(wholesaleRevenue)} <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>/</span> {fmt(retailRevenue)}</div>
        </div>
        <div className="metric"><div className="label">Credit (udhaari) due</div><div className="value mono" style={{ color: totalCreditDue ? "#A32D2D" : "var(--ink)" }}>{fmt(totalCreditDue)}</div></div>
      </div>

      <div className="panel">
        <h3>Sales Report</h3>
        {salesByParty.length === 0 ? <div className="emptystate">No sales yet.</div> : (
          <table>
            <thead><tr><th style={{ width: 50 }}>S.No</th><th>Party</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {salesByParty.map((s, idx) => (
                <tr key={s.party}><td>{idx + 1}</td><td>{s.party}</td><td style={{ textAlign: "right" }} className="mono">{fmt(s.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h3>Last 7 days</h3>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#756B5D" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#756B5D" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="wholesale" stackId="a" fill="#B07C1F" />
              <Bar dataKey="retail" stackId="a" fill="#D6431F" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <h3>Sales by subunit</h3>
        {salesBySubunit.length === 0 ? <div className="emptystate">No sales yet.</div> : (
          <table>
            <thead><tr><th>Subunit</th><th>Case</th><th>Loose</th><th style={{ textAlign: "right" }}>Revenue</th></tr></thead>
            <tbody>
              {salesBySubunit.map((s) => (
                <tr key={s.subunit}>
                  <td><span className="badge ok">{s.subunit}</span></td>
                  <td>{s.caseQty}</td>
                  <td>{s.subunitQty}</td>
                  <td style={{ textAlign: "right" }} className="mono">{fmt(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="split-two">
        <div className="panel">
          <h3>Low stock alerts</h3>
          {lowStockItems.length === 0 ? <div className="emptystate">All products are well stocked.</div> : (
            <table><tbody>
              {lowStockItems.map((p) => (
                <tr key={p.id}><td>{p.name}</td><td style={{ textAlign: "right" }}>
                  <span className="badge low"><AlertTriangle size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{p.stock} left</span>
                </td></tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="panel">
          <h3>Recent invoices</h3>
          {invoices.length === 0 ? <div className="emptystate">No bills generated yet.</div> : (
            <table><tbody>
              {invoices.slice(0, 5).map((inv) => (
                <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => setViewInvoice(inv)}>
                  <td><div style={{ fontWeight: 500 }}>{inv.customerName}</div><div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{inv.invoiceNo}</div></td>
                  <td style={{ textAlign: "right" }} className="mono">{fmt(inv.total)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      </div>
    </>
  );
}

function BillTab(props) {
  const {
    products, productQuery, setProductQuery, cart, addToCart, updateCartQty, updateCartMode, updateCartPrice, removeFromCart,
    customerType, setCustomerType, customerName, setCustomerName, customerPhone, setCustomerPhone, customerPlace, setCustomerPlace, customers,
    discountPct, setDiscountPct, subtotal, discountAmt, cgstAmt, sgstAmt, igstAmt, taxType, setTaxType,
    grandTotal, saveQuotation, settings, agents, selectedAgentId, setSelectedAgentId, addProduct, units,
  } = props;

  const [showNewProduct, setShowNewProduct] = useState(false);
  const blankNewProduct = { name: "", category: "", subunit: (units && units[0]) || "Pcs", caseContent: 1, sku: "", wholesalePrice: 0, retailPrice: 0, costPrice: 0, stock: 0, lowStock: 5 };
  const [newProduct, setNewProduct] = useState(blankNewProduct);

  const gstRate = taxType === "intra" ? (Number(settings.cgstRate) || 0) + (Number(settings.sgstRate) || 0) : (Number(settings.igstRate) || 0);
  const gstAmt = taxType === "intra" ? cgstAmt + sgstAmt : igstAmt;

  function submitNewProduct() {
    if (!newProduct.name.trim()) return;
    const created = addProduct({
      ...newProduct,
      category: newProduct.category.trim() || "General",
      caseContent: Number(newProduct.caseContent) || 1,
      wholesalePrice: Number(newProduct.wholesalePrice) || 0,
      retailPrice: Number(newProduct.retailPrice) || 0,
      costPrice: Number(newProduct.costPrice) || 0,
      stock: Number(newProduct.stock) || 0,
      lowStock: Number(newProduct.lowStock) || 5,
    });
    if (created) addToCart(created);
    setNewProduct(blankNewProduct);
    setShowNewProduct(false);
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">New quotation</div></div>
      <div className="split-main">
        <div>
          <div className="segrow">
            <button className={`segbtn wholesale ${customerType === "wholesale" ? "active wholesale" : ""}`} onClick={() => setCustomerType("wholesale")}>Wholesale</button>
            <button className={`segbtn retail ${customerType === "retail" ? "active retail" : ""}`} onClick={() => setCustomerType("retail")}>Retail</button>
          </div>

          <div className="formgrid" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Customer name</label>
              <input list="cust-names" placeholder="Walk-in customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <datalist id="cust-names">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div className="field">
              <label>Phone (optional)</label>
              <input list="cust-phones" placeholder="98xxxxxxxx" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              <datalist id="cust-phones">{customers.map((c) => <option key={c.id} value={c.phone} />)}</datalist>
            </div>
            <div className="field">
              <label>Place (optional)</label>
              <input list="cust-places" placeholder="Sivakasi, Sattur..." value={customerPlace} onChange={(e) => setCustomerPlace(e.target.value)} />
              <datalist id="cust-places">{customers.map((c) => <option key={c.id} value={c.location || ""} />)}</datalist>
            </div>
            <div className="field">
              <label>Agent (optional)</label>
              <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
                <option value="">No agent</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>GST type</label>
              <select value={taxType} onChange={(e) => setTaxType(e.target.value)}>
                <option value="intra">Intrastate (CGST + SGST)</option>
                <option value="inter">Interstate (IGST)</option>
              </select>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>Add products</h3>
              <button className="iconbtn" title="Add new product" onClick={() => setShowNewProduct(!showNewProduct)}>
                <Plus size={18} color="#D6431F" />
              </button>
            </div>

            {showNewProduct && (
              <div style={{ background: "#FBF6EC", border: "0.5px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Customer asked for a new product — add it here</div>
                <div className="formgrid" style={{ marginBottom: 8 }}>
                  <div className="field"><label>Product name</label><input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /></div>
                  <div className="field"><label>Category</label><input value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} /></div>
                  <div className="field"><label>Subunit</label>
                    <select value={newProduct.subunit} onChange={(e) => setNewProduct({ ...newProduct, subunit: e.target.value })}>
                      {(units || ["Pcs"]).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Case content</label><input type="number" value={newProduct.caseContent} onChange={(e) => setNewProduct({ ...newProduct, caseContent: e.target.value })} /></div>
                  <div className="field"><label>Wholesale price</label><input type="number" value={newProduct.wholesalePrice} onChange={(e) => setNewProduct({ ...newProduct, wholesalePrice: e.target.value })} /></div>
                  <div className="field"><label>Retail price</label><input type="number" value={newProduct.retailPrice} onChange={(e) => setNewProduct({ ...newProduct, retailPrice: e.target.value })} /></div>
                  <div className="field"><label>Stock</label><input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} /></div>
                  <div className="field"><label>Cost price</label><input type="number" value={newProduct.costPrice} onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value })} /></div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="primarybtn" style={{ width: "auto", padding: "8px 16px" }} onClick={submitNewProduct}>Add & put in quotation</button>
                  <button className="ghostbtn" onClick={() => setShowNewProduct(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="searchwrap"><Search size={14} /><input placeholder="Search by name, category or SKU" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} /></div>
            <div className="prodlist">
              {products.length === 0 ? <div className="emptystate">No products found.</div> : products.map((p) => {
                const unitPrice = customerType === "wholesale" ? p.wholesalePrice : p.retailPrice;
                return (
                  <div className="prodrow" key={p.id} onClick={() => addToCart(p)}>
                    <div>
                      <div className="pname">{p.name}</div>
                      <div className="pmeta">{p.category} • 1 Case = {p.caseContent} {p.subunit} • Stock: {p.stock} {p.subunit}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="mono" style={{ fontSize: 12.5 }}>
                        {fmt(unitPrice)}/{p.subunit} • {fmt(unitPrice * p.caseContent)}/Case
                      </span>
                      <Plus size={16} color="#D6431F" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <h3>Quotation summary</h3>
          {cart.length === 0 ? <div className="emptystate">Add products from the left to start a quotation.</div> : (
            <table>
              <thead><tr><th>Item</th><th style={{ width: 100 }}>Unit</th><th style={{ width: 56 }}>Qty</th><th style={{ width: 64 }}>Price</th><th style={{ width: 26 }}></th></tr></thead>
              <tbody>
                {cart.map((c) => (
                  <tr key={c.productId}>
                    <td><div style={{ fontWeight: 500 }}>{c.name}</div><div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{fmt(lineTotal(c))}</div></td>
                    <td>
                      <select value={c.mode} onChange={(e) => updateCartMode(c.productId, e.target.value)} style={{ padding: "5px 4px", fontSize: 11.5 }}>
                        <option value="case">Case ({c.caseContent} {c.subunit})</option>
                        <option value="subunit">{c.subunit} (loose)</option>
                      </select>
                    </td>
                    <td><input type="number" min="1" value={c.qty} onChange={(e) => updateCartQty(c.productId, parseInt(e.target.value || "1", 10))} style={{ padding: "5px 6px", fontSize: 13.5, fontWeight: 600, textAlign: "center" }} /></td>
                    <td><input type="number" min="0" value={c.price} onChange={(e) => updateCartPrice(c.productId, parseFloat(e.target.value || "0"))} style={{ padding: "5px 6px", fontSize: 12 }} /></td>
                    <td><button className="iconbtn" onClick={() => removeFromCart(c.productId)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="fuse"><div className="dash" /><div className="dot" /><div className="dash" /></div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>Discount %</label>
            <input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
          </div>

          <div className="totalrow"><span>Subtotal</span><span className="mono">{fmt(subtotal)}</span></div>
          <div className="totalrow"><span>Discount</span><span className="mono">-{fmt(discountAmt)}</span></div>
          {settings.gstEnabled && (
            <div className="totalrow"><span>GST ({gstRate}%)</span><span className="mono">{fmt(gstAmt)}</span></div>
          )}
          <div className="totalrow grand"><span>Grand total</span><span className="mono">{fmt(grandTotal)}</span></div>

          <div style={{ marginTop: 14 }}>
            <button className="primarybtn" disabled={cart.length === 0} onClick={saveQuotation}>Save quotation <ArrowRight size={15} /></button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 8 }}>
            A quotation doesn't affect stock. Convert it to an estimate from the Quotations tab once the customer confirms.
          </div>
        </div>
      </div>
    </>
  );
}

function CompaniesTab({ companies, addCompany, updateCompany, deleteCompany }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const blank = { name: "", tagline: "", address: "", phone: "", email: "", website: "" };
  const [form, setForm] = useState(blank);

  function startEdit(c) { setEditingId(c.id); setForm(c); setShowForm(true); }
  function startNew() { setEditingId(null); setForm(blank); setShowForm(true); }
  function submit() {
    if (!form.name.trim()) return;
    if (editingId) updateCompany(editingId, form); else addCompany(form);
    setShowForm(false); setForm(blank); setEditingId(null);
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Companies</div>
        <button className="ghostbtn" onClick={startNew}><Plus size={14} /> Add company</button>
      </div>

      {showForm && (
        <div className="panel">
          <h3>{editingId ? "Edit company" : "New company"}</h3>
          <div className="formgrid">
            <div className="field"><label>Company name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Tagline</label><input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
            <div className="field"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="primarybtn" style={{ width: "auto", padding: "9px 18px" }} onClick={submit}>{editingId ? "Save changes" : "Add company"}</button>
            <button className="ghostbtn" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel">
        {companies.length === 0 ? <div className="emptystate">No companies yet. Add one to bill under multiple business names.</div> : (
          <table>
            <thead><tr><th>Company name</th><th>Address</th><th></th></tr></thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ fontSize: 12.5 }}>{c.address}</td>
                  <td><div style={{ display: "flex", gap: 4 }}>
                    <button className="iconbtn" onClick={() => startEdit(c)}><Pencil size={14} /></button>
                    <button className="iconbtn" onClick={() => deleteCompany(c.id)}><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function UsersTab({ users, addUser, deleteUser }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  function submit() {
    if (!name.trim()) return;
    addUser({ name: name.trim(), mobile: mobile.trim(), createdDate: todayStr() });
    setName(""); setMobile("");
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Users</div></div>
      <div className="panel">
        <h3>Add user</h3>
        <div className="formgrid" style={{ marginBottom: 10 }}>
          <div className="field"><label>User name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Mobile number</label><input value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
        </div>
        <button className="primarybtn" style={{ width: "auto", padding: "9px 18px" }} onClick={submit}>Add user</button>
      </div>
      <div className="panel">
        {users.length === 0 ? <div className="emptystate">No users yet.</div> : (
          <table>
            <thead><tr><th>Created date</th><th>User name</th><th>Mobile number</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.createdDate}</td>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td>{u.mobile}</td>
                  <td><button className="iconbtn" onClick={() => deleteUser(u.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function AgentsTab({ agents, addAgent, deleteAgent }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  function submit() {
    if (!name.trim()) return;
    addAgent({ name: name.trim(), mobile: mobile.trim() });
    setName(""); setMobile("");
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Agents</div></div>
      <div className="panel">
        <h3>Add agent</h3>
        <div className="formgrid" style={{ marginBottom: 10 }}>
          <div className="field"><label>Agent name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kannan - Sattur" /></div>
          <div className="field"><label>Mobile number</label><input value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
        </div>
        <button className="primarybtn" style={{ width: "auto", padding: "9px 18px" }} onClick={submit}>Add agent</button>
      </div>
      <div className="panel">
        {agents.length === 0 ? <div className="emptystate">No agents yet.</div> : (
          <table>
            <thead><tr><th>Agent name</th><th>Mobile</th><th></th></tr></thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}><td style={{ fontWeight: 500 }}>{a.name}</td><td>{a.mobile}</td>
                  <td><button className="iconbtn" onClick={() => deleteAgent(a.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function UnitsTab({ units, addUnit, deleteUnit }) {
  const [name, setName] = useState("");
  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Units</div></div>
      <div className="panel">
        <h3>Add unit</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bundle, PKT" style={{ maxWidth: 240 }} />
          <button className="ghostbtn" onClick={() => { addUnit(name); setName(""); }}><Plus size={13} /> Add</button>
        </div>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>Unit name</th><th></th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u}><td>{u}</td><td><button className="iconbtn" onClick={() => deleteUnit(u)}><Trash2 size={14} /></button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function QuotationsTab({ quotations, convertQuotationToEstimate, deleteQuotation, setViewQuotation }) {
  const [convertingId, setConvertingId] = useState(null);
  const [payMode, setPayMode] = useState("Cash");
  const [payAmt, setPayAmt] = useState("");

  function startConvert(q) {
    setConvertingId(q.id);
    setPayMode("Cash");
    setPayAmt(q.total.toFixed(0));
  }
  function confirmConvert(q) {
    convertQuotationToEstimate(q, payMode, payAmt);
    setConvertingId(null);
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Quotations</div></div>
      <div className="panel">
        {quotations.length === 0 ? <div className="emptystate">No quotations yet. Create one from New quotation.</div> : (
          <table>
            <thead><tr><th>Quote no</th><th>Date</th><th>Customer</th><th>Type</th><th style={{ textAlign: "right" }}>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {quotations.map((q) => (
                <React.Fragment key={q.id}>
                  <tr>
                    <td className="mono">{q.quoteNo}</td>
                    <td>{q.date}</td>
                    <td>{q.customerName}</td>
                    <td><span className={`badge ${q.customerType}`}>{q.customerType}</span></td>
                    <td style={{ textAlign: "right" }} className="mono">{fmt(q.total)}</td>
                    <td><span className={`badge ${q.status === "converted" ? "ok" : "low"}`}>{q.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="iconbtn" onClick={() => setViewQuotation(q)}><FileText size={14} /></button>
                        {q.status === "pending" && (
                          <>
                            <button className="iconbtn" onClick={() => startConvert(q)}><ArrowRight size={14} /></button>
                            <button className="iconbtn" onClick={() => deleteQuotation(q.id)}><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {convertingId === q.id && (
                    <tr><td colSpan={7}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 4px" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Convert to estimate:</span>
                        <select value={payMode} onChange={(e) => setPayMode(e.target.value)} style={{ width: 110 }}>
                          <option>Cash</option><option>UPI</option><option>Card</option><option>Credit</option>
                        </select>
                        <input type="number" placeholder="Amount paid" style={{ width: 130 }} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
                        <button className="ghostbtn" onClick={() => confirmConvert(q)}>Confirm</button>
                        <button className="ghostbtn" onClick={() => setConvertingId(null)}>Cancel</button>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function CustomersTab({ customers, invoices, recordCustomerPayment, deleteCustomer, updateCustomer }) {
  const [expanded, setExpanded] = useState(null);
  const [payAmt, setPayAmt] = useState({});
  const [editForm, setEditForm] = useState({});

  function saveIdent(c) {
    const patch = editForm[c.id] || {};
    updateCustomer(customers.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Customers</div></div>
      <div className="panel">
        {customers.length === 0 ? <div className="emptystate">No customers yet. They're added automatically when you bill with a phone number.</div> : (
          <table>
            <thead><tr><th>Party name</th><th>Phone</th><th>Identification</th><th>Type</th><th>Balance due</th><th></th></tr></thead>
            <tbody>
              {customers.map((c) => {
                const history = invoices.filter((i) => i.customerId === c.id);
                const ef = editForm[c.id] || { location: c.location || "", identType: c.identType || "GSTIN", identValue: c.identValue || "" };
                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                      <td style={{ fontWeight: 500 }}>{c.name}{c.location ? ` - ${c.location}` : ""}</td>
                      <td>{c.phone}</td>
                      <td style={{ fontSize: 12 }}>{c.identType && c.identValue ? `${c.identType}: ${c.identValue}` : "—"}</td>
                      <td><span className={`badge ${c.type}`}>{c.type}</span></td>
                      <td className="mono" style={{ color: c.balanceDue > 0 ? "#A32D2D" : "var(--ink)" }}>{fmt(c.balanceDue || 0)}</td>
                      <td><button className="iconbtn" onClick={(e) => { e.stopPropagation(); deleteCustomer(c.id); }}><Trash2 size={14} /></button></td>
                    </tr>
                    {expanded === c.id && (
                      <tr><td colSpan={6}>
                        <div style={{ padding: "8px 4px" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Party details</div>
                          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            <input placeholder="Location / city" style={{ width: 160 }} value={ef.location}
                              onChange={(e) => setEditForm({ ...editForm, [c.id]: { ...ef, location: e.target.value } })} />
                            <select style={{ width: 110 }} value={ef.identType}
                              onChange={(e) => setEditForm({ ...editForm, [c.id]: { ...ef, identType: e.target.value } })}>
                              <option>GSTIN</option><option>Aadhaar</option>
                            </select>
                            <input placeholder="ID number" style={{ width: 180 }} value={ef.identValue}
                              onChange={(e) => setEditForm({ ...editForm, [c.id]: { ...ef, identValue: e.target.value } })} />
                            <button className="ghostbtn" onClick={() => saveIdent(c)}>Save</button>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Purchase history</div>
                          {history.length === 0 ? <div className="emptystate">No purchases yet.</div> : history.map((h) => (
                            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}>
                              <span>{h.invoiceNo} • {h.date}</span><span className="mono">{fmt(h.total)}</span>
                            </div>
                          ))}
                          {c.balanceDue > 0 && (
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <input type="number" placeholder="Amount received" style={{ width: 160 }}
                                value={payAmt[c.id] || ""} onChange={(e) => setPayAmt({ ...payAmt, [c.id]: e.target.value })} />
                              <button className="ghostbtn" onClick={() => { recordCustomerPayment(c.id, Number(payAmt[c.id]) || 0); setPayAmt({ ...payAmt, [c.id]: "" }); }}>Record payment</button>
                            </div>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ProductsTab({ products, addProduct, updateProduct, deleteProduct, units }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const blank = { name: "", category: "", subunit: units[0] || "Pcs", caseContent: 1, sku: "", wholesalePrice: 0, retailPrice: 0, costPrice: 0, stock: 0, lowStock: 5 };
  const [form, setForm] = useState(blank);
  const fileInputRef = React.useRef(null);

  function startEdit(p) { setEditingId(p.id); setForm(p); setShowForm(true); }
  function startNew() { setEditingId(null); setForm(blank); setShowForm(true); }
  function submit() {
    if (!form.name.trim()) return;
    const payload = {
      ...form, category: form.category.trim() || CATEGORY_DEFAULT,
      wholesalePrice: Number(form.wholesalePrice) || 0, retailPrice: Number(form.retailPrice) || 0,
      costPrice: Number(form.costPrice) || 0, stock: Number(form.stock) || 0, lowStock: Number(form.lowStock) || 5,
      caseContent: Number(form.caseContent) || 1,
    };
    if (editingId) updateProduct(editingId, payload); else addProduct(payload);
    setShowForm(false); setForm(blank); setEditingId(null);
  }

  function downloadTemplate() {
    downloadXlsx([{ Name: "Sample Cracker", Category: "Sky Shots", Subunit: "Pcs", CaseContent: 10, SKU: "SC-001", CostPrice: 30, WholesalePrice: 40, RetailPrice: 55, Stock: 100, LowStock: 20 }], "product_template.xlsx", "Template");
  }
  function downloadProducts() {
    const rows = products.map((p) => ({
      Name: p.name, Category: p.category, Subunit: p.subunit, CaseContent: p.caseContent, SKU: p.sku,
      CostPrice: p.costPrice, WholesalePrice: p.wholesalePrice, RetailPrice: p.retailPrice, Stock: p.stock, LowStock: p.lowStock,
    }));
    downloadXlsx(rows, "products.xlsx", "Products");
  }
  function handleUploadFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        rows.forEach((r) => {
          if (!r.Name) return;
          addProduct({
            name: String(r.Name), category: String(r.Category || CATEGORY_DEFAULT), subunit: String(r.Subunit || units[0] || "Pcs"),
            caseContent: Number(r.CaseContent) || 1, sku: String(r.SKU || ""), costPrice: Number(r.CostPrice) || 0,
            wholesalePrice: Number(r.WholesalePrice) || 0, retailPrice: Number(r.RetailPrice) || 0,
            stock: Number(r.Stock) || 0, lowStock: Number(r.LowStock) || 5,
          });
        });
      } catch (err) { /* ignore malformed file */ }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Products & stock</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghostbtn" onClick={downloadTemplate}><Download size={14} /> Download template</button>
          <button className="ghostbtn" onClick={() => fileInputRef.current && fileInputRef.current.click()}>Upload products</button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleUploadFile} />
          <button className="ghostbtn" onClick={downloadProducts} disabled={products.length === 0}><Download size={14} /> Download products</button>
          <button className="primarybtn" style={{ width: "auto", padding: "9px 16px" }} onClick={startNew}><Plus size={14} /> Add</button>
        </div>
      </div>

      {showForm && (
        <div className="panel">
          <h3>{editingId ? "Edit product" : "New product"}</h3>
          <div className="formgrid">
            <div className="field"><label>Product name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Sky Shots, Chakkar..." /></div>
            <div className="field"><label>SKU / Barcode</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SS-010" /></div>
            <div className="field"><label>Subunit</label>
              <select value={form.subunit} onChange={(e) => setForm({ ...form, subunit: e.target.value })}>
                {units.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Case content (subunits per case)</label><input type="number" value={form.caseContent} onChange={(e) => setForm({ ...form, caseContent: e.target.value })} /></div>
            <div className="field"><label>Stock ({form.subunit})</label><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
            <div className="field"><label>Cost price / {form.subunit}</label><input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></div>
            <div className="field"><label>Wholesale price / {form.subunit}</label><input type="number" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} /></div>
            <div className="field"><label>Retail price / {form.subunit}</label><input type="number" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} /></div>
            <div className="field"><label>Low stock alert below</label><input type="number" value={form.lowStock} onChange={(e) => setForm({ ...form, lowStock: e.target.value })} /></div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 10 }}>
            Amount = Case qty × Case content × Price (when billed by case). Amount = Subunit qty × Price (when billed loose, per {form.subunit}).
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="primarybtn" style={{ width: "auto", padding: "9px 18px" }} onClick={submit}>{editingId ? "Save changes" : "Add product"}</button>
            <button className="ghostbtn" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel">
        <table>
          <thead><tr><th>Product</th><th>SKU</th><th>Case content</th><th>Cost</th><th>Wholesale</th><th>Retail</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><div style={{ fontWeight: 500 }}>{p.name}</div><div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{p.category}</div></td>
                <td className="mono" style={{ fontSize: 12 }}>{p.sku || "—"}</td>
                <td style={{ fontSize: 12.5 }}>1 Case = {p.caseContent} {p.subunit}</td>
                <td className="mono">{fmt(p.costPrice || 0)}</td>
                <td className="mono">{fmt(p.wholesalePrice)}</td>
                <td className="mono">{fmt(p.retailPrice)}</td>
                <td><span className={`badge ${p.stock <= p.lowStock ? "low" : "ok"}`}>{p.stock} {p.subunit}</span></td>
                <td><div style={{ display: "flex", gap: 4 }}>
                  <button className="iconbtn" onClick={() => startEdit(p)}><Pencil size={14} /></button>
                  <button className="iconbtn" onClick={() => deleteProduct(p.id)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PurchasesTab({ products, stockins, addStockIn }) {
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([{ productId: "", qty: 1, costPrice: 0 }]);

  function updateRow(idx, patch) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((prev) => [...prev, { productId: "", qty: 1, costPrice: 0 }]); }
  function removeRow(idx) { setRows((prev) => prev.filter((_, i) => i !== idx)); }

  function submit() {
    const items = rows
      .filter((r) => r.productId)
      .map((r) => {
        const prod = products.find((p) => p.id === r.productId);
        return { productId: r.productId, name: prod ? prod.name : "", qty: Number(r.qty) || 0, costPrice: Number(r.costPrice) || 0, total: (Number(r.qty) || 0) * (Number(r.costPrice) || 0) };
      });
    if (items.length === 0 || !supplierName.trim()) return;
    const totalCost = items.reduce((s, i) => s + i.total, 0);
    addStockIn({ supplierName: supplierName.trim(), date, items, totalCost });
    setSupplierName(""); setRows([{ productId: "", qty: 1, costPrice: 0 }]);
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Purchases (stock-in)</div></div>
      <div className="panel">
        <h3>New purchase entry</h3>
        <div className="formgrid" style={{ marginBottom: 10 }}>
          <div className="field"><label>Supplier name</label><input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} /></div>
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        {rows.map((r, idx) => (
          <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <select style={{ flex: 2 }} value={r.productId} onChange={(e) => updateRow(idx, { productId: e.target.value })}>
              <option value="">Select product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Qty" style={{ flex: 1 }} value={r.qty} onChange={(e) => updateRow(idx, { qty: e.target.value })} />
            <input type="number" placeholder="Cost/box" style={{ flex: 1 }} value={r.costPrice} onChange={(e) => updateRow(idx, { costPrice: e.target.value })} />
            <button className="iconbtn" onClick={() => removeRow(idx)}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="ghostbtn" onClick={addRow}><Plus size={13} /> Add row</button>
        <div style={{ marginTop: 14 }}><button className="primarybtn" style={{ width: "auto", padding: "10px 20px" }} onClick={submit}>Save purchase</button></div>
      </div>

      <div className="panel">
        <h3>Purchase history</h3>
        {stockins.length === 0 ? <div className="emptystate">No purchases recorded yet.</div> : (
          <table>
            <thead><tr><th>Supplier</th><th>Date</th><th>Items</th><th style={{ textAlign: "right" }}>Total cost</th></tr></thead>
            <tbody>
              {stockins.map((s) => (
                <tr key={s.id}>
                  <td>{s.supplierName}</td><td>{s.date}</td>
                  <td style={{ fontSize: 12 }}>{s.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</td>
                  <td style={{ textAlign: "right" }} className="mono">{fmt(s.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function AdvanceOrdersTab({ products, advanceOrders, addAdvanceOrder, updateAdvanceStatus, deleteAdvanceOrder }) {
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [advancePaid, setAdvancePaid] = useState(0);
  const [rows, setRows] = useState([{ productId: "", qty: 1 }]);

  function updateRow(idx, patch) { setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))); }
  function addRow() { setRows((prev) => [...prev, { productId: "", qty: 1 }]); }
  function removeRow(idx) { setRows((prev) => prev.filter((_, i) => i !== idx)); }

  function submit() {
    const items = rows.filter((r) => r.productId).map((r) => {
      const prod = products.find((p) => p.id === r.productId);
      return { productId: r.productId, name: prod ? prod.name : "", qty: Number(r.qty) || 0, price: prod ? prod.retailPrice : 0 };
    });
    if (items.length === 0 || !customerName.trim()) return;
    const estimatedTotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    addAdvanceOrder({ customerName: customerName.trim(), phone: phone.trim(), items, estimatedTotal, advancePaid: Number(advancePaid) || 0, deliveryDate });
    setShowForm(false); setCustomerName(""); setPhone(""); setDeliveryDate(""); setAdvancePaid(0); setRows([{ productId: "", qty: 1 }]);
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Advance orders (seasonal pre-booking)</div>
        <button className="ghostbtn" onClick={() => setShowForm(!showForm)}><Plus size={14} /> New advance order</button>
      </div>

      {showForm && (
        <div className="panel">
          <h3>New advance order</h3>
          <div className="formgrid" style={{ marginBottom: 10 }}>
            <div className="field"><label>Customer name</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
            <div className="field"><label>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="field"><label>Expected delivery date</label><input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
            <div className="field"><label>Advance amount collected</label><input type="number" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} /></div>
          </div>
          {rows.map((r, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select style={{ flex: 2 }} value={r.productId} onChange={(e) => updateRow(idx, { productId: e.target.value })}>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" placeholder="Qty" style={{ flex: 1 }} value={r.qty} onChange={(e) => updateRow(idx, { qty: e.target.value })} />
              <button className="iconbtn" onClick={() => removeRow(idx)}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="ghostbtn" onClick={addRow}><Plus size={13} /> Add row</button>
          <div style={{ marginTop: 14 }}><button className="primarybtn" style={{ width: "auto", padding: "10px 20px" }} onClick={submit}>Save advance order</button></div>
        </div>
      )}

      <div className="panel">
        {advanceOrders.length === 0 ? <div className="emptystate">No advance orders yet.</div> : (
          <table>
            <thead><tr><th>Customer</th><th>Delivery</th><th>Advance paid</th><th>Est. total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {advanceOrders.map((o) => (
                <tr key={o.id}>
                  <td>{o.customerName}<div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{o.phone}</div></td>
                  <td>{o.deliveryDate || "—"}</td>
                  <td className="mono">{fmt(o.advancePaid)}</td>
                  <td className="mono">{fmt(o.estimatedTotal)}</td>
                  <td>
                    <select value={o.status} onChange={(e) => updateAdvanceStatus(o.id, e.target.value)} style={{ padding: "4px 6px", fontSize: 12 }}>
                      <option value="pending">Pending</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td><button className="iconbtn" onClick={() => deleteAdvanceOrder(o.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function InvoicesTab({ invoices, setViewInvoice, returnFromInvoice }) {
  const [returningId, setReturningId] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});

  function exportInvoices() {
    const rows = invoices.map((inv) => ({
      Invoice: inv.invoiceNo, Date: inv.date, Customer: inv.customerName, Phone: inv.customerPhone,
      Type: inv.customerType, Subtotal: inv.subtotal, Discount: inv.discountAmt,
      CGST: inv.cgstAmt || 0, SGST: inv.sgstAmt || 0, Total: inv.total, PaymentMode: inv.paymentMode, BalanceDue: inv.balanceDue || 0,
    }));
    downloadXlsx(rows, "invoices.xlsx", "Invoices");
  }

  function startReturn(inv) {
    setReturningId(inv.id);
    setReturnQtys({});
  }
  function submitReturn(inv) {
    const items = inv.items
      .map((it, idx) => ({ idx, qty: Number(returnQtys[idx]) || 0 }))
      .filter((r) => r.qty > 0);
    if (items.length === 0) return;
    returnFromInvoice(inv, items);
    setReturningId(null);
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Estimates (sales)</div>
        <button className="ghostbtn" onClick={exportInvoices} disabled={invoices.length === 0}><Download size={14} /> Export Excel</button>
      </div>
      <div className="panel">
        {invoices.length === 0 ? <div className="emptystate">No estimates generated yet. Convert a quotation, or create one directly from New quotation.</div> : (
          <table>
            <thead><tr><th>Estimate</th><th>Date</th><th>Customer</th><th>Type</th><th>Payment</th><th style={{ textAlign: "right" }}>Total</th><th></th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <React.Fragment key={inv.id}>
                  <tr>
                    <td className="mono">{inv.invoiceNo}</td><td>{inv.date}</td><td>{inv.customerName}</td>
                    <td><span className={`badge ${inv.customerType}`}>{inv.customerType}</span></td>
                    <td>{inv.paymentMode}{inv.balanceDue > 0 && <span style={{ color: "#A32D2D", fontSize: 11 }}> (due {fmt(inv.balanceDue)})</span>}</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmt(inv.total)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="iconbtn" onClick={() => setViewInvoice(inv)}><FileText size={14} /></button>
                        <button className="iconbtn" title="Return items" onClick={() => startReturn(inv)}><ArrowRight size={14} style={{ transform: "rotate(180deg)" }} /></button>
                      </div>
                    </td>
                  </tr>
                  {returningId === inv.id && (
                    <tr><td colSpan={7}>
                      <div style={{ padding: "10px 4px" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Return items from {inv.invoiceNo}</div>
                        {inv.items.map((it, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 12.5 }}>
                            <span style={{ flex: 1 }}>{it.name} (sold {it.qty} {it.mode === "case" ? "Case" : it.subunit})</span>
                            <input type="number" min="0" max={it.qty} placeholder="Return qty" style={{ width: 110 }}
                              value={returnQtys[idx] || ""} onChange={(e) => setReturnQtys({ ...returnQtys, [idx]: e.target.value })} />
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button className="ghostbtn" onClick={() => submitReturn(inv)}>Confirm return</button>
                          <button className="ghostbtn" onClick={() => setReturningId(null)}>Cancel</button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                  {inv.returns && inv.returns.length > 0 && (
                    <tr><td colSpan={7} style={{ fontSize: 11, color: "var(--ink-soft)", paddingTop: 0 }}>
                      Returned: {inv.returns.map((r) => `${fmt(r.value)} on ${r.date}`).join(", ")}
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ReportsTab({ invoices, products }) {
  const topProducts = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => inv.items.forEach((it) => { map[it.name] = (map[it.name] || 0) + it.qty; }));
    return Object.entries(map).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [invoices]);

  const monthly = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      const key = inv.date.slice(0, 7);
      map[key] = (map[key] || 0) + inv.total;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, revenue]) => ({ month, revenue }));
  }, [invoices]);

  const stockValueByCategory = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p.category] = (map[p.category] || 0) + p.stock * (p.costPrice || 0); });
    return Object.entries(map).map(([category, value]) => ({ category, value }));
  }, [products]);

  const salesBySubunit = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => inv.items.forEach((it) => {
      const key = it.subunit || "Pcs";
      if (!map[key]) map[key] = { subunit: key, caseQty: 0, subunitQty: 0, revenue: 0 };
      if (it.mode === "case") map[key].caseQty += it.qty; else map[key].subunitQty += it.qty;
      map[key].revenue += it.total;
    }));
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [invoices]);

  const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
  const totalCost = invoices.reduce((s, i) => s + i.items.reduce((s2, it) => s2 + it.qty * (it.costPrice || 0), 0), 0);
  const profit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  function exportSalesTax() {
    const rows = invoices.map((inv) => ({
      "Inv No & Date": `${inv.invoiceNo} ${inv.date}`, Party: inv.customerName,
      TaxableValue: inv.subtotal - inv.discountAmt,
      CGST: inv.cgstAmt || 0, SGST: inv.sgstAmt || 0, IGST: inv.igstAmt || 0,
      TaxAmount: (inv.cgstAmt || 0) + (inv.sgstAmt || 0) + (inv.igstAmt || 0), TotalAmount: inv.total,
    }));
    downloadXlsx(rows, "sales_tax_report.xlsx", "Sales Tax");
  }

  function exportStock() {
    const rows = products.map((p) => ({
      Product: p.name, SKU: p.sku, Category: p.category, Stock: p.stock, CostPrice: p.costPrice,
      WholesalePrice: p.wholesalePrice, RetailPrice: p.retailPrice, StockValue: p.stock * (p.costPrice || 0),
    }));
    downloadXlsx(rows, "stock_report.xlsx", "Stock");
  }
  function exportSubunitReport() {
    const rows = salesBySubunit.map((s) => ({ Subunit: s.subunit, "Sold by case": s.caseQty, "Sold loose (subunit)": s.subunitQty, Revenue: s.revenue }));
    downloadXlsx(rows, "sales_by_subunit.xlsx", "Subunit sales");
  }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Reports</div>
        <button className="ghostbtn" onClick={exportStock}><Download size={14} /> Export stock Excel</button>
      </div>

      <div className="cardrow cardrow-3">
        <div className="metric"><div className="label">Total revenue</div><div className="value mono">{fmt(totalRevenue)}</div></div>
        <div className="metric"><div className="label">Total profit</div><div className="value mono">{fmt(profit)}</div></div>
        <div className="metric"><div className="label">Profit margin</div><div className="value mono">{marginPct.toFixed(1)}%</div></div>
      </div>

      <div className="split-two">
        <div className="panel">
          <h3>Top-selling products</h3>
          {topProducts.length === 0 ? <div className="emptystate">No sales yet.</div> : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="qty" fill="#D6431F" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="panel">
          <h3>Monthly revenue</h3>
          {monthly.length === 0 ? <div className="emptystate">No sales yet.</div> : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="revenue" fill="#B07C1F" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Sales by subunit (Case / Unit / Pit / Pcs / Box / Vandal)</h3>
          <button className="ghostbtn" onClick={exportSubunitReport} disabled={salesBySubunit.length === 0}><Download size={14} /> Export Excel</button>
        </div>
        {salesBySubunit.length === 0 ? <div className="emptystate">No sales yet.</div> : (
          <>
            <div style={{ height: 180, marginBottom: 14 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesBySubunit}>
                  <XAxis dataKey="subunit" tick={{ fontSize: 11, fill: "#756B5D" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="revenue" fill="#D6431F" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table>
              <thead><tr><th>Subunit</th><th>Sold by case</th><th>Sold loose</th><th style={{ textAlign: "right" }}>Revenue</th></tr></thead>
              <tbody>
                {salesBySubunit.map((s) => (
                  <tr key={s.subunit}>
                    <td><span className="badge ok">{s.subunit}</span></td>
                    <td>{s.caseQty} Case</td>
                    <td>{s.subunitQty} {s.subunit}</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmt(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Sales Tax Report</h3>
          <button className="ghostbtn" onClick={exportSalesTax} disabled={invoices.length === 0}><Download size={14} /> Download Sales tax</button>
        </div>
        {invoices.length === 0 ? <div className="emptystate">No estimates yet.</div> : (
          <table>
            <thead><tr><th>Inv.No & Date</th><th>Party</th><th>Taxable value</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Tax amount</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
            <tbody>
              {invoices.map((inv) => {
                const taxAmt = (inv.cgstAmt || 0) + (inv.sgstAmt || 0) + (inv.igstAmt || 0);
                return (
                  <tr key={inv.id}>
                    <td style={{ fontSize: 12 }}>{inv.invoiceNo}<br />{inv.date}</td>
                    <td>{inv.customerName}</td>
                    <td className="mono">{fmt(inv.subtotal - inv.discountAmt)}</td>
                    <td className="mono">{fmt(inv.cgstAmt || 0)}</td>
                    <td className="mono">{fmt(inv.sgstAmt || 0)}</td>
                    <td className="mono">{fmt(inv.igstAmt || 0)}</td>
                    <td className="mono">{fmt(taxAmt)}</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmt(inv.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h3>Stock value by category</h3>
        <table>
          <thead><tr><th>Category</th><th style={{ textAlign: "right" }}>Stock value</th></tr></thead>
          <tbody>
            {stockValueByCategory.map((c) => (
              <tr key={c.category}><td>{c.category}</td><td style={{ textAlign: "right" }} className="mono">{fmt(c.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsTab({ settings, setSettings, persistSettings, resetCounter }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);

  function save() { setSettings(local); persistSettings(local); }

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Settings</div></div>

      <div className="panel">
        <h3>Bill numbering</h3>
        <div className="split-two-14">
          <div>
            <div style={{ fontSize: 12.5, marginBottom: 6 }}>Next quotation number: <span className="mono" style={{ fontWeight: 700 }}>{((settings.quoteCounter || 0) + 1).toString().padStart(3, "0")}/QUT{fyLabel()}</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ghostbtn" disabled>Continue from last</button>
              <button className="ghostbtn" onClick={() => resetCounter("quote")}>Reset to 1</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, marginBottom: 6 }}>Next estimate number: <span className="mono" style={{ fontWeight: 700 }}>{((settings.invoiceCounter || 0) + 1).toString().padStart(3, "0")}/INV{fyLabel()}</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ghostbtn" disabled>Continue from last</button>
              <button className="ghostbtn" onClick={() => resetCounter("invoice")}>Reset to 1</button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Business (appears on printed bills)</h3>
        <div className="formgrid">
          <div className="field"><label>Business name</label><input value={local.businessName} onChange={(e) => setLocal({ ...local, businessName: e.target.value })} /></div>
          <div className="field"><label>Tagline</label><input value={local.tagline} onChange={(e) => setLocal({ ...local, tagline: e.target.value })} placeholder="Sivakasi's finest fireworks" /></div>
          <div className="field"><label>Address</label><input value={local.address} onChange={(e) => setLocal({ ...local, address: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input value={local.phone} onChange={(e) => setLocal({ ...local, phone: e.target.value })} /></div>
          <div className="field"><label>Email</label><input value={local.email} onChange={(e) => setLocal({ ...local, email: e.target.value })} /></div>
          <div className="field"><label>Website</label><input value={local.website} onChange={(e) => setLocal({ ...local, website: e.target.value })} /></div>
        </div>
      </div>

      <div className="panel">
        <h3>GST</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={local.gstEnabled} onChange={(e) => setLocal({ ...local, gstEnabled: e.target.checked })} />
          Enable GST on bills
        </label>
        {local.gstEnabled && (
          <div className="formgrid">
            <div className="field"><label>CGST %</label><input type="number" value={local.cgstRate} onChange={(e) => setLocal({ ...local, cgstRate: e.target.value })} /></div>
            <div className="field"><label>SGST %</label><input type="number" value={local.sgstRate} onChange={(e) => setLocal({ ...local, sgstRate: e.target.value })} /></div>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Fireworks license</h3>
        <div className="formgrid">
          <div className="field"><label>License number</label><input value={local.licenseNumber} onChange={(e) => setLocal({ ...local, licenseNumber: e.target.value })} /></div>
          <div className="field"><label>Expiry date</label><input type="date" value={local.licenseExpiry} onChange={(e) => setLocal({ ...local, licenseExpiry: e.target.value })} /></div>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>A reminder banner shows on the dashboard once expiry is within 30 days.</div>
      </div>

      <button className="primarybtn" style={{ width: "auto", padding: "10px 22px" }} onClick={save}>Save settings</button>
    </>
  );
}

function ReceiptCard({ doc, kind, settings, onClose }) {
  const contactLine = [settings.website, settings.phone, settings.email].filter(Boolean).join("  |  ");
  const isEstimate = kind === "estimate";
  const paymentStatus = isEstimate ? (doc.balanceDue > 0 ? (doc.amountPaid > 0 ? "PARTIAL" : "PENDING") : "PAID") : null;
  const docNo = isEstimate ? doc.invoiceNo : doc.quoteNo;
  const docLabel = isEstimate ? "Invoice No" : "Quote No";
  const titleText = isEstimate ? "ESTIMATE BILL" : "QUOTATION";
  const gstRate = doc.taxType === "inter" ? doc.igstRate : (Number(doc.cgstRate || 0) + Number(doc.sgstRate || 0));
  const gstAmt = doc.taxType === "inter" ? doc.igstAmt : (Number(doc.cgstAmt || 0) + Number(doc.sgstAmt || 0));

  return (
    <div className="estimate" onClick={(e) => e.stopPropagation()}>
      <button className="iconbtn est-close" onClick={onClose}><X size={16} /></button>

      <div className="est-header">
        <div className="disp est-bizname">{settings.businessName}</div>
        {settings.tagline && <div className="est-tagline">{settings.tagline.toUpperCase()}</div>}
        {contactLine && <div className="est-contact">{contactLine}</div>}
      </div>
      <div className="est-rule" />

      <div className="est-title">{titleText}</div>
      {!isEstimate && doc.status === "converted" && (
        <div style={{ textAlign: "center", marginBottom: 10 }}><span className="badge ok">Converted to estimate</span></div>
      )}

      <div className="est-parties">
        <div>
          <div className="est-label">FROM</div>
          <div className="est-name">{settings.businessName}</div>
          <div className="est-line">{settings.address}</div>
          {settings.phone && <div className="est-line">{settings.phone}</div>}
          {settings.email && <div className="est-line">{settings.email}</div>}
          {settings.website && <div className="est-line">{settings.website}</div>}
        </div>
        <div>
          <div className="est-label">{isEstimate ? "BILL TO" : "QUOTE FOR"}</div>
          <div className="est-name">{doc.customerName}</div>
          {doc.customerPhone && <div className="est-line">Mobile: {doc.customerPhone}</div>}
          {doc.customerPlace && <div className="est-line">Place: {doc.customerPlace}</div>}
          <span className={`badge ${doc.customerType}`} style={{ marginTop: 4 }}>{doc.customerType}</span>
        </div>
      </div>

      <div className="est-orderbar">
        <span>{docLabel}: <strong>{docNo}</strong></span>
        {doc.agentName && <span>Agent: <strong>{doc.agentName}</strong></span>}
        <span>Date: <strong>{doc.date}</strong></span>
      </div>

      <table className="est-table">
        <thead><tr><th>SL.N</th><th>Product name</th><th>Qty</th><th>Rate (Rs.)</th><th>Per</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
        <tbody>
          {doc.items.map((it, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{it.name}</td>
              <td>{it.qty} {it.mode === "case" ? "Case" : it.subunit}</td>
              <td>{fmt(it.price)}</td>
              <td>{it.subunit}</td>
              <td style={{ textAlign: "right" }}>{fmt(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="est-terms">
        <div className="est-label" style={{ marginBottom: 6 }}>TERMS & CONDITIONS</div>
        <ol>
          <li>Product images are for reference only; actual items may vary.</li>
          <li>Delivery charges are payable by customer to the transport provider.</li>
          <li>Prices are valid at the time of quotation and subject to change.</li>
        </ol>
      </div>

      <div className="est-totals">
        <div className="est-totrow"><span>Subtotal</span><span>{fmt(doc.subtotal)}</span></div>
        <div className="est-totrow"><span>Discount ({doc.discountPct}%)</span><span>-{fmt(doc.discountAmt)}</span></div>
        {doc.gstEnabled && (
          <div className="est-totrow"><span>GST ({gstRate}%)</span><span>{fmt(gstAmt)}</span></div>
        )}
        <div className="est-totrow grand"><span>Grand total</span><span>{fmt(doc.total)}</span></div>
      </div>

      <div className="est-rule" style={{ margin: "16px 0 10px" }} />
      <div className="est-footer">
        {isEstimate ? (
          <>
            Thank you for your business with {settings.businessName}<br />
            Payment: {doc.paymentMode} ({paymentStatus}){doc.balanceDue > 0 && ` — Balance due ${fmt(doc.balanceDue)}`}
          </>
        ) : (
          <>This is a quotation, not a final bill. Convert it to an estimate once confirmed.</>
        )}
      </div>

      <button className="ghostbtn" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} onClick={() => window.print()}>
        <Printer size={14} /> Print
      </button>
    </div>
  );
}
const globalStyles = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
* { box-sizing: border-box; }
.app-root {
  --bg: #F7F3EC; --panel: #FFFFFF; --ink: #211C15; --ink-soft: #756B5D;
  --accent: #D6431F; --accent-soft: #F5DCC9; --gold: #B07C1F; --gold-soft: #F1E3C4;
  --green: #3F6B4C; --green-soft: #E1EBDF; --line: #E5DDCB; --sidebar: #211C15; --sidebar-soft: #B8AC98;
  font-family: 'Inter', sans-serif; background: var(--bg); color: var(--ink);



.app-root {
  --bg: #F7F3EC;
  --panel: #FFFFFF;
  --ink: #211C15;
  --ink-soft: #756B5D;
  --accent: #D6431F;
  --accent-soft: #F5DCC9;
  --gold: #B07C1F;
  --gold-soft: #F1E3C4;
  --green: #3F6B4C;
  --green-soft: #E1EBDF;
  --line: #E5DDCB;
  --sidebar: #211C15;
  --sidebar-soft: #B8AC98;

  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--ink);

  display: flex;
  width: 100%;
  min-width: 100%;
  min-height: 100vh;
  height: 100vh;

  margin: 0;
  padding: 0;

  max-width: none;
  border-radius: 0;
  border: none;
  box-shadow: none;
  overflow: hidden;
}
display: flex; width: 100%; min-width: 100%; height: 100%; min-height: 0; box-sizing: border-box; overflow: hidden;
}

.disp { font-family: 'Space Grotesk', sans-serif; }
.mono { font-family: 'JetBrains Mono', monospace; }



.sidebar {
  width: 230px;
  min-width: 230px;
  height: 100vh;
  min-height: 100vh;

  background: var(--sidebar);
  color: var(--sidebar-soft);

  padding: 20px 14px;

  display: flex;
  flex-direction: column;
  gap: 3px;

  flex-shrink: 0;
  overflow-y: auto;
}





.brand-mark { width:10px; height:10px; border-radius:50%; background: var(--accent); box-shadow: 0 0 0 3px rgba(214,67,31,0.25); }
.brand-name { color:#F7F3EC; font-size:15px; font-weight:700; letter-spacing:0.2px; }
.navbtn { display:flex; align-items:center; gap:10px; padding: 9px 12px; border-radius:8px; cursor:pointer; font-size: 12.8px; font-weight: 500; color: var(--sidebar-soft); background: transparent; border: none; text-align:left; width:100%; }
.navbtn:hover { background: rgba(247,243,236,0.08); color:#F7F3EC; }
.navbtn.active { background: var(--accent); color: #FCEFE8; }

.main {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 100vh;

  padding: 32px 36px;

  overflow-y: auto;
  overflow-x: hidden;
}
.topbar { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:22px; }
.pagetitle { font-size:20px; font-weight:700; }
.datepill { font-size:12px; color: var(--ink-soft); background: var(--panel); border:0.5px solid var(--line); padding:5px 10px; border-radius:20px; }
.licensebanner { display:flex; align-items:center; gap:8px; background: var(--gold-soft); color:#7A5716; border-radius:8px; padding:9px 14px; font-size:12.5px; font-weight:600; margin-bottom:16px; }
.licensebanner.expired { background:#F7DEDA; color:#A32D2D; }
.cardrow { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-bottom: 20px; }
.metric { background: var(--panel); border:0.5px solid var(--line); border-radius:10px; padding:14px 16px; }
.metric .label { font-size:11.5px; color: var(--ink-soft); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:6px; }
.metric .value { font-size:21px; font-weight:700; }
.panel { background: var(--panel); border:0.5px solid var(--line); border-radius:10px; padding:16px 18px; margin-bottom:16px; }
.panel h3 { font-size:13.5px; font-weight:600; margin:0 0 12px; color: var(--ink); }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { text-align:left; color: var(--ink-soft); font-weight:500; font-size:11.5px; text-transform:uppercase; letter-spacing:0.3px; padding:6px 8px; border-bottom:0.5px solid var(--line); }
td { padding:9px 8px; border-bottom:0.5px solid var(--line); }
tr:last-child td { border-bottom:none; }
.badge { display:inline-block; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:600; }
.badge.wholesale { background: var(--gold-soft); color: #7A5716; }
.badge.retail { background: var(--accent-soft); color: #9C371A; }
.badge.low { background: #F7DEDA; color: #A32D2D; }
.badge.ok { background: var(--green-soft); color: #2C5138; }
.segrow { display:flex; gap:8px; margin-bottom:16px; }
.segbtn { flex:1; padding:11px; border-radius:8px; border: 0.5px solid var(--line); background: var(--panel); font-weight:600; font-size:13.5px; cursor:pointer; color: var(--ink-soft); }
.segbtn.active.wholesale { background: var(--gold); color:#FBF3E4; border-color: var(--gold); }
.segbtn.active.retail { background: var(--accent); color:#FDECE4; border-color: var(--accent); }
.field { margin-bottom:12px; }
.field label { display:block; font-size:12px; color: var(--ink-soft); margin-bottom:4px; font-weight:500; }
input, select { width:100%; padding:8px 10px; border-radius:7px; border:0.5px solid var(--line); background:#FBF9F4; font-size:13.5px; font-family:'Inter',sans-serif; color: var(--ink); }
input:focus, select:focus { outline:none; border-color: var(--accent); }
input[type=checkbox] { width:auto; }
.searchwrap { position:relative; margin-bottom:10px; }
.searchwrap svg { position:absolute; left:10px; top:10px; color: var(--ink-soft); }
.searchwrap input { padding-left:32px; }
.prodlist { max-height:220px; overflow-y:auto; border:0.5px solid var(--line); border-radius:8px; }
.prodrow { display:flex; justify-content:space-between; align-items:center; padding:9px 12px; border-bottom:0.5px solid var(--line); font-size:13px; cursor:pointer; }
.prodrow:last-child { border-bottom:none; }
.prodrow:hover { background: #FBF6EC; }
.prodrow .pname { font-weight:500; }
.prodrow .pmeta { font-size:11.5px; color: var(--ink-soft); }
.iconbtn { background:none; border:none; cursor:pointer; color: var(--ink-soft); padding:4px; border-radius:6px; display:flex; }
.iconbtn:hover { background: var(--line); color: var(--ink); }
.fuse { display:flex; align-items:center; gap:6px; margin: 14px 0; color: var(--line); }
.fuse .dash { flex:1; border-top: 1.5px dashed var(--line); }
.fuse .dot { width:5px; height:5px; border-radius:50%; background: var(--accent); }
.totalrow { display:flex; justify-content:space-between; font-size:13.5px; padding:4px 0; color: var(--ink-soft); }
.totalrow.grand { font-size:19px; font-weight:700; color: var(--ink); padding-top:8px; border-top: 0.5px solid var(--line); margin-top:6px; }
.primarybtn { background: var(--accent); color:#FDECE4; border:none; padding:12px; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:6px; }
.primarybtn:disabled { opacity:0.4; cursor:not-allowed; }
.ghostbtn { background:transparent; border:0.5px solid var(--line); padding:9px 14px; border-radius:7px; font-size:13px; font-weight:600; cursor:pointer; color: var(--ink); display:flex; align-items:center; gap:6px; }
.ghostbtn:hover { background: #F2ECDD; }
.ghostbtn:disabled { opacity:0.4; cursor:not-allowed; }
.modal-backdrop { position: relative; min-height: 100%; background: rgba(33,28,21,0.55); display:flex; align-items:center; justify-content:center; padding: 24px; border-radius: 12px; }
.estimate { background:#FFFFFF; width: 640px; max-width: 100%; max-height: 90vh; overflow-y:auto; border-radius:6px; padding: 32px 36px; position:relative; font-family:'Inter', sans-serif; color: var(--ink); }
.est-close { position:absolute; top:14px; right:14px; }
.est-header { text-align:center; margin-bottom:10px; }
.est-bizname { font-size:26px; font-weight:700; color: var(--accent); letter-spacing:0.5px; }
.est-tagline { font-size:11px; letter-spacing:1.5px; color: var(--ink-soft); margin-top:2px; }
.est-contact { font-size:11.5px; color: var(--green); margin-top:8px; }
.est-rule { border-top: 2.5px solid var(--accent); }
.est-title { text-align:center; font-size:15px; font-weight:700; letter-spacing:1px; margin: 18px 0; }
.est-parties { display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:18px; }
.est-label { font-size:11px; color: var(--ink-soft); letter-spacing:0.5px; margin-bottom:4px; }
.est-name { font-weight:700; font-size:13.5px; margin-bottom:2px; }
.est-line { font-size:12.5px; color: var(--ink); line-height:1.5; }
.est-orderbar { display:flex; justify-content:space-between; background: var(--gold-soft); padding:9px 14px; border-radius:4px; font-size:12.5px; margin-bottom:14px; }
.est-table { width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:16px; }
.est-table th { background: var(--sidebar); color:#F1E9D8; text-align:left; padding:8px 10px; font-size:11px; letter-spacing:0.3px; }
.est-table td { padding:8px 10px; border-bottom:0.5px solid var(--line); }
.est-terms { font-size:11px; color: var(--ink-soft); margin-bottom:18px; }
.est-terms ol { margin:0; padding-left:16px; line-height:1.7; }
.est-totals { margin-left:auto; width:260px; }
.est-totrow { display:flex; justify-content:space-between; font-size:12.5px; padding:4px 0; color: var(--ink-soft); }
.est-totrow.grand { font-size:17px; font-weight:700; color: var(--accent); border-top: 1px solid var(--line); padding-top:8px; margin-top:4px; }
.est-footer { text-align:center; font-size:11.5px; color: var(--ink-soft); line-height:1.7; }
@media print { .est-close, .ghostbtn { display:none; } }
.formgrid { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
.emptystate { text-align:center; padding: 30px 10px; color: var(--ink-soft); font-size:13px; }
/* Layout helper classes (replace fragile inline grid-template-columns) */
.cardrow-5 { grid-template-columns: repeat(5, 1fr); }
.cardrow-3 { grid-template-columns: repeat(3, 1fr); }
.split-main { display:grid; grid-template-columns: 1.3fr 1fr; gap:18px; }
.split-two { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
.split-two-14 { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }

/* ===== Responsive: tablet & mobile ===== */
@media (max-width: 900px) {
  .app-root { flex-direction: column; width: 100%; min-width: 100%; height: auto; min-height: auto; overflow: visible; }
  .sidebar {
    width: 100%; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center;
    padding: 12px; gap: 6px; position: sticky; top: 0; z-index: 10;
  }
  .brand-row { width: 100%; padding: 0 4px 10px; }
  .navbtn { width: auto; flex: 1 1 auto; justify-content: center; font-size: 11.5px; padding: 8px 8px; }
  .main { padding: 16px; }
  .topbar { flex-wrap: wrap; gap: 8px; }
  .cardrow, .cardrow-5, .cardrow-3 { grid-template-columns: repeat(2, 1fr) !important; }
  .split-main, .split-two, .split-two-14, .formgrid {
    grid-template-columns: 1fr !important;
  }
  table { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
  .estimate { width: 100%; padding: 22px 16px; }
  .modal-backdrop { padding: 10px; }
  .prodlist { max-height: 240px; }
  .est-parties { grid-template-columns: 1fr !important; gap: 12px; }
}

@media (max-width: 520px) {
  .cardrow, .cardrow-5, .cardrow-3 { grid-template-columns: 1fr !important; }
  .segrow { flex-direction: column; }
  .metric .value { font-size: 18px; }
  .est-orderbar { flex-direction: column; gap: 4px; align-items: flex-start; }
  .navbtn { font-size: 11px; padding: 7px; }
}

`;
