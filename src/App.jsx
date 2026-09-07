import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
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
  proformas: "spark-billing-proformas",
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
// Amount = Quantity x Sub Unit Contains x Sub Unit Rate
// (loose/direct sale = set Sub Unit Contains to 1)
const subUnitQty = (item) => (Number(item.qty) || 0) * (Number(item.subUnitContains) || 1);
const lineTotal = (item) => subUnitQty(item) * (Number(item.subUnitRate) || 0);
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
  gstRate: 18,
  licenseNumber: "",
  licenseExpiry: "",
  seasonalMode: false,
  quoteCounter: 0,
  invoiceCounter: 0,
  proformaCounter: 0,
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
  const [proformas, setProformas] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);

  const [editingName, setEditingName] = useState(false);

  const [cart, setCart] = useState([]);
  const [customerType, setCustomerType] = useState("wholesale");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [taxType, setTaxType] = useState("intra");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [extraCharges, setExtraCharges] = useState(0);
  const [productQuery, setProductQuery] = useState("");
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewQuotation, setViewQuotation] = useState(null);
  const [viewProforma, setViewProforma] = useState(null);
  const [syncError, setSyncError] = useState(false);

  const CACHE_PREFIX = "spark-billing-cache::";
  function cacheRead(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function cacheWrite(key, value) {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); } catch (e) {}
  }

  useEffect(() => {
    (async () => {
      let anyError = false;
      const load = async (key, fallback) => {
        try {
          const r = await window.storage.get(key);
          if (r && r.value) {
            const parsed = JSON.parse(r.value);
            cacheWrite(key, parsed); // keep local backup in sync with the cloud copy
            return parsed;
          }
        } catch (e) {
          console.error(`Failed to load "${key}" from the cloud:`, e);
          anyError = true;
          const cached = cacheRead(key);
          if (cached !== null) return cached; // fall back to last known-good local copy, not empty defaults
        }
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
      setProformas(await load(KEYS.proformas, []));
      setSettings(await load(KEYS.settings, defaultSettings));
      setSyncError(anyError);
      setReady(true);
    })();
  }, []);

  async function persist(key, setter, next) {
    setter(next);
    cacheWrite(key, next); // save locally first — never lost even if the cloud call fails
    try {
      await window.storage.set(key, JSON.stringify(next));
      setSyncError(false);
    } catch (e) {
      console.error(`Failed to save "${key}" to the cloud:`, e);
      setSyncError(true);
    }
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
  const persistProformas = (next) => persist(KEYS.proformas, setProformas, next);

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

  function addCartLine(line) {
    setCart((prev) => [...prev, { lineId: uid(), ...line }]);
  }
  function updateCartField(lineId, field, value) {
    setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, [field]: value } : c)));
  }
  function removeFromCart(lineId) {
    setCart((prev) => prev.filter((c) => c.lineId !== lineId));
  }

  const subtotal = cart.reduce((s, c) => s + lineTotal(c), 0);
  const discountAmt = (subtotal * (Number(discountPct) || 0)) / 100;
  const discountedTotal = Math.max(0, subtotal - discountAmt);
  const taxable = discountedTotal;
  const gstHalfRate = (Number(settings.gstRate) || 0) / 2;
  const cgstAmt = settings.gstEnabled && taxType === "intra" ? (taxable * gstHalfRate) / 100 : 0;
  const sgstAmt = settings.gstEnabled && taxType === "intra" ? (taxable * gstHalfRate) / 100 : 0;
  const igstAmt = settings.gstEnabled && taxType === "inter" ? (taxable * (Number(settings.gstRate) || 0)) / 100 : 0;
  const grandTotal = taxable + cgstAmt + sgstAmt + igstAmt + (Number(extraCharges) || 0);

  function nextQuoteNo() {
    const n = (settings.quoteCounter || 0) + 1;
    return { no: `${n.toString().padStart(3, "0")}/QUT${fyLabel()}`, counter: n };
  }
  function nextEstimateNo() {
    const n = (settings.invoiceCounter || 0) + 1;
    return { no: `${n.toString().padStart(3, "0")}/INV${fyLabel()}`, counter: n };
  }
  function nextProformaNo() {
    const n = (settings.proformaCounter || 0) + 1;
    return { no: `${n.toString().padStart(3, "0")}/PRO${fyLabel()}`, counter: n };
  }
  function resetCounter(type) {
    const patch = type === "quote" ? { quoteCounter: 0 } : type === "proforma" ? { proformaCounter: 0 } : { invoiceCounter: 0 };
    const next = { ...settings, ...patch };
    persistSettings(next);
  }

  async function generateProformaFromInvoice(invoice, editedItems, editedDiscountPct, editedExtraCharges) {
    const { no, counter } = nextProformaNo();
    const sub = editedItems.reduce((s, it) => s + lineTotal(it), 0);
    const discPct = Number(editedDiscountPct) || 0;
    const discAmt = (sub * discPct) / 100;
    const discountedTot = Math.max(0, sub - discAmt);
    const taxable2 = discountedTot;
    const half = (Number(settings.gstRate) || 0) / 2;
    const cgst2 = invoice.taxType === "intra" && settings.gstEnabled ? (taxable2 * half) / 100 : 0;
    const sgst2 = invoice.taxType === "intra" && settings.gstEnabled ? (taxable2 * half) / 100 : 0;
    const igst2 = invoice.taxType === "inter" && settings.gstEnabled ? (taxable2 * (Number(settings.gstRate) || 0)) / 100 : 0;
    const extra = Number(editedExtraCharges) || 0;
    const total2 = taxable2 + cgst2 + sgst2 + igst2 + extra;

    const proforma = {
      id: uid(), proformaNo: no, date: todayStr(), sourceInvoiceId: invoice.id, sourceInvoiceNo: invoice.invoiceNo,
      customerName: invoice.customerName, customerPhone: invoice.customerPhone, customerType: invoice.customerType,
      agentId: invoice.agentId || null, agentName: invoice.agentName || "",
      items: editedItems.map((it) => ({ ...it, total: lineTotal(it) })),
      discountPct: discPct, subtotal: sub, discountAmt: discAmt, discountedTotal: discountedTot,
      extraCharges: extra, gstEnabled: settings.gstEnabled, taxType: invoice.taxType,
      cgstRate: half, sgstRate: half, igstRate: settings.gstRate,
      cgstAmt: cgst2, sgstAmt: sgst2, igstAmt: igst2, total: total2, docType: "Original",
    };
    await persistProformas([proforma, ...proformas]);
    await persistSettings({ ...settings, proformaCounter: counter });
    setViewProforma(proforma);
  }

  async function saveQuotation() {
    if (cart.length === 0) return;
    const { no, counter } = nextQuoteNo();
    const name = customerName.trim() || "Walk-in customer";
    const phone = customerPhone.trim();
    const agent = agents.find((a) => a.id === selectedAgentId);
    const staffUser = users.find((u) => u.id === selectedUserId);

    const quotation = {
      id: uid(),
      quoteNo: no,
      date: todayStr(),
      customerName: name,
      customerPhone: phone,
      customerType,
      agentId: agent ? agent.id : null,
      agentName: agent ? agent.name : "",
      createdByUserId: staffUser ? staffUser.id : null,
      createdByUserName: staffUser ? staffUser.name : "",
      items: cart.map((c) => ({
        productId: c.productId, name: c.name, unit: c.unit || "Case", subunit: c.subunit,
        subUnitContains: Number(c.subUnitContains) || 1, subUnitRate: Number(c.subUnitRate) || 0,
        qty: Number(c.qty) || 0, costPrice: c.costPrice || 0, total: lineTotal(c),
      })),
      discountPct: Number(discountPct) || 0,
      subtotal, discountAmt, discountedTotal,
      extraCharges: Number(extraCharges) || 0,
      gstEnabled: settings.gstEnabled, taxType, gstRate: settings.gstRate, cgstRate: gstHalfRate, sgstRate: gstHalfRate, igstRate: settings.gstRate,
      cgstAmt, sgstAmt, igstAmt,
      total: grandTotal,
      status: "pending",
      invoiceId: null,
      docType: "Original",
    };
    await persistQuotations([quotation, ...quotations]);
    await persistSettings({ ...settings, quoteCounter: counter });

    setCart([]); setCustomerName(""); setCustomerPhone(""); setDiscountPct(0); setExtraCharges(0); setSelectedAgentId(""); setSelectedUserId("");
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
        nextCustomers = customers.map((c) => (c.id === existing.id ? { ...c, balanceDue: (c.balanceDue || 0) + due, type: quotation.customerType } : c));
      } else {
        custId = uid();
        nextCustomers = [...customers, { id: custId, name: quotation.customerName, phone: quotation.customerPhone, address: "", identType: "GSTIN", identValue: "", type: quotation.customerType, balanceDue: due }];
      }
      await persistCustomers(nextCustomers);
    }

    const invoice = {
      id: uid(), invoiceNo: no, date: todayStr(), customerId: custId,
      customerName: quotation.customerName, customerPhone: quotation.customerPhone, customerType: quotation.customerType,
      agentId: quotation.agentId || null, agentName: quotation.agentName || "",
      createdByUserId: quotation.createdByUserId || null, createdByUserName: quotation.createdByUserName || "",
      items: quotation.items, discountPct: quotation.discountPct, subtotal: quotation.subtotal, discountAmt: quotation.discountAmt,
      discountedTotal: quotation.discountedTotal, extraCharges: quotation.extraCharges || 0,
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
      const subunitsSold = (Number(item.qty) || 0) * (Number(item.subUnitContains) || 1);
      return { ...p, stock: Math.max(0, p.stock - subunitsSold) };
    });
    await persistProducts(nextProducts);

    await persistQuotations(quotations.map((q) => (q.id === quotation.id ? { ...q, status: "converted", invoiceId: invoice.id } : q)));
    setViewInvoice(invoice);
  }

  async function returnFromInvoice(invoice, returnItems) {
    const returnedValue = returnItems.reduce((s, r) => {
      const item = invoice.items[r.idx];
      const unitTotal = (Number(item.subUnitContains) || 1) * (Number(item.subUnitRate) || 0);
      return s + r.qty * unitTotal;
    }, 0);
    if (returnedValue <= 0) return;

    const nextProducts = products.map((p) => {
      const match = returnItems.find((r) => invoice.items[r.idx].productId === p.id);
      if (!match) return p;
      const item = invoice.items[match.idx];
      const subunitsBack = match.qty * (Number(item.subUnitContains) || 1);
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
          ["proformas", "Proformas", FileText],
          ["reports", "Reports", BarChart3],
          ["settings", "Settings", SettingsIcon],
        ].map(([key, label, Icon]) => (
          <button key={key} className={`navbtn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="main">
        {syncError && (
          <div className="licensebanner expired">
            <ShieldAlert size={15} />
            Couldn't reach the cloud just now — your changes are saved on this device and will sync once the connection is back. Don't clear your browser data until it syncs.
          </div>
        )}
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
            products, cart, addCartLine, updateCartField, removeFromCart,
            customerType, setCustomerType, customerName, setCustomerName, customerPhone, setCustomerPhone, customers,
            discountPct, setDiscountPct, extraCharges, setExtraCharges, subtotal, discountAmt, discountedTotal,
            cgstAmt, sgstAmt, igstAmt, taxType, setTaxType,
            grandTotal, saveQuotation, settings, agents, selectedAgentId, setSelectedAgentId, addProduct, units,
            users, selectedUserId, setSelectedUserId,
          }} />
        )}
        {tab === "quotations" && (
          <QuotationsTab {...{ quotations, convertQuotationToEstimate, deleteQuotation, setViewQuotation }} />
        )}
        {tab === "customers" && (
          <CustomersTab {...{ customers, invoices, recordCustomerPayment, deleteCustomer, updateCustomer: persistCustomers }} />
        )}
        {tab === "agents" && (
          <AgentsTab {...{ agents, addAgent, deleteAgent, invoices }} />
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
          <InvoicesTab {...{ invoices, setViewInvoice, generateProformaFromInvoice, units }} />
        )}
        {tab === "proformas" && (
          <ProformasTab {...{ proformas, setViewProforma }} />
        )}
        {tab === "reports" && (
          <ReportsTab {...{ invoices, products, agents, users }} />
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
      {viewProforma && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="modal-backdrop" style={{ position: "fixed", inset: 0, minHeight: "auto" }}>
            <ReceiptCard doc={viewProforma} kind="proforma" settings={settings} onClose={() => setViewProforma(null)} />
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
      if (!map[key]) map[key] = { subunit: key, unitsSold: 0, revenue: 0 };
      map[key].unitsSold += (Number(it.qty) || 0) * (Number(it.subUnitContains) || 1);
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
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4} barCategoryGap="30%">
              <CartesianGrid stroke="#E5DDCB" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#756B5D" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#756B5D" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Bar dataKey="wholesale" name="Wholesale" fill="#B07C1F" maxBarSize={36} radius={[3, 3, 0, 0]} />
              <Bar dataKey="retail" name="Retail" fill="#D6431F" maxBarSize={36} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <h3>Sales by subunit</h3>
        {salesBySubunit.length === 0 ? <div className="emptystate">No sales yet.</div> : (
          <table>
            <thead><tr><th>Subunit</th><th>Units sold</th><th style={{ textAlign: "right" }}>Revenue</th></tr></thead>
            <tbody>
              {salesBySubunit.map((s) => (
                <tr key={s.subunit}>
                  <td><span className="badge ok">{s.subunit}</span></td>
                  <td>{s.unitsSold}</td>
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
    products, cart, addCartLine, updateCartField, removeFromCart,
    customerType, setCustomerType, customerName, setCustomerName, customerPhone, setCustomerPhone, customers,
    discountPct, setDiscountPct, extraCharges, setExtraCharges, subtotal, discountAmt, discountedTotal,
    cgstAmt, sgstAmt, igstAmt, taxType, setTaxType,
    grandTotal, saveQuotation, settings, agents, selectedAgentId, setSelectedAgentId, addProduct, units,
    users, selectedUserId, setSelectedUserId,
  } = props;

  const [showNewProduct, setShowNewProduct] = useState(false);
  const blankNewProduct = { name: "", category: "", subunit: (units && units[0]) || "Pcs", caseContent: 1, sku: "", wholesalePrice: 0, retailPrice: 0, costPrice: 0, stock: 0, lowStock: 5 };
  const [newProduct, setNewProduct] = useState(blankNewProduct);

  const blankEntry = { productId: "", qty: "", unit: "Case", subunit: "", subUnitContains: "", subUnitRate: "" };
  const [entry, setEntry] = useState(blankEntry);

  function pickProduct(productId) {
    const p = products.find((pr) => pr.id === productId);
    if (!p) { setEntry(blankEntry); return; }
    const rate = customerType === "wholesale" ? p.wholesalePrice : p.retailPrice;
    setEntry({ productId, qty: 1, unit: "Case", subunit: p.subunit, subUnitContains: p.caseContent, subUnitRate: rate });
  }

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
    setNewProduct(blankNewProduct);
    setShowNewProduct(false);
    if (created) pickProduct(created.id);
  }

  const entryProduct = products.find((p) => p.id === entry.productId);
  const entrySubUnitQty = (Number(entry.qty) || 0) * (Number(entry.subUnitContains) || 1);
  const entryAmount = entrySubUnitQty * (Number(entry.subUnitRate) || 0);

  function addEntryToCart() {
    if (!entryProduct || !entry.qty) return;
    addCartLine({
      productId: entryProduct.id, name: entryProduct.name, costPrice: entryProduct.costPrice || 0,
      unit: entry.unit || "Case", subunit: entry.subunit || entryProduct.subunit,
      subUnitContains: Number(entry.subUnitContains) || 1, subUnitRate: Number(entry.subUnitRate) || 0,
      qty: Number(entry.qty) || 1,
    });
    setEntry(blankEntry);
  }

  return (
    <>
      <div className="topbar">
        <div className="pagetitle disp">New quotation</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>Bill Value</div>
          <div className="disp mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>{fmt(grandTotal)}</div>
        </div>
      </div>

      <div className="segrow">
        <button className={`segbtn wholesale ${customerType === "wholesale" ? "active wholesale" : ""}`} onClick={() => setCustomerType("wholesale")}>Wholesale</button>
        <button className={`segbtn retail ${customerType === "retail" ? "active retail" : ""}`} onClick={() => setCustomerType("retail")}>Retail</button>
      </div>

      <div className="formgrid" style={{ marginBottom: 14, gridTemplateColumns: "repeat(4, 1fr)" }}>
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
          <label>Agent (optional)</label>
          <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
            <option value="">No agent</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Created by (staff)</label>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Not recorded</option>
            {(users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Add product</h3>
        </div>

        {showNewProduct && (
          <div style={{ background: "#FBF6EC", border: "0.5px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Customer asked for a new product — save it here, then pick it below</div>
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
              <button className="primarybtn" style={{ width: "auto", padding: "8px 16px" }} onClick={submitNewProduct}>Save to products</button>
              <button className="ghostbtn" onClick={() => setShowNewProduct(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="entrygrid">
          <div className="field">
            <label>Product</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={entry.productId} onChange={(e) => pickProduct(e.target.value)} style={{ flex: 1 }}>
                <option value="">Select</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="iconbtn addicon" title="Add new product" onClick={() => setShowNewProduct(!showNewProduct)}><Plus size={18} /></button>
            </div>
          </div>
          <div className="field"><label>Quantity</label><input type="number" min="0" placeholder="Quantity" value={entry.qty} onChange={(e) => setEntry({ ...entry, qty: e.target.value })} /></div>
          <div className="field"><label>Unit</label>
            <select value={entry.unit} onChange={(e) => setEntry({ ...entry, unit: e.target.value })}>
              {(units || ["Case"]).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="field"><label>Sub Unit</label>
            <select value={entry.subunit} onChange={(e) => setEntry({ ...entry, subunit: e.target.value })}>
              <option value="">Select</option>
              {(units || []).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="entrygrid" style={{ marginTop: 10 }}>
          <div className="field"><label>Sub Unit Contains</label><input type="number" min="0" placeholder="Sub Unit Contains" value={entry.subUnitContains} onChange={(e) => setEntry({ ...entry, subUnitContains: e.target.value })} /></div>
          <div className="field"><label>Sub Unit Quantity</label><input value={entrySubUnitQty || ""} placeholder="Sub Unit Quantity" disabled /></div>
          <div className="field"><label>Sub Unit Rate</label><input type="number" min="0" placeholder="Sub Unit Rate" value={entry.subUnitRate} onChange={(e) => setEntry({ ...entry, subUnitRate: e.target.value })} /></div>
          <div className="field">
            <label>Amount</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={entryAmount || ""} placeholder="Amount" disabled style={{ flex: 1 }} />
              <button className="iconbtn addicon" title="Add to bill" onClick={addEntryToCart}><Plus size={18} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        {cart.length === 0 ? <div className="emptystate">Add products above to start a quotation.</div> : (
          <table className="billtable">
            <thead>
              <tr>
                <th>S.No</th><th>Product</th><th style={{ width: 70 }}>Quantity</th><th style={{ width: 90 }}>Unit</th>
                <th style={{ width: 110 }}>Sub Unit</th><th style={{ width: 90 }}>Sub Unit Contains</th>
                <th style={{ width: 90 }}>Sub Unit Quantity</th><th style={{ width: 90 }}>Sub Unit Rate</th>
                <th style={{ width: 90, textAlign: "right" }}>Amount</th><th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((c, idx) => (
                <tr key={c.lineId}>
                  <td>{idx + 1}</td>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td><input type="number" min="0" value={c.qty} onChange={(e) => updateCartField(c.lineId, "qty", parseFloat(e.target.value) || 0)} style={{ width: "100%", boxSizing: "border-box" }} /></td>
                  <td>{c.unit}</td>
                  <td>
                    <select value={c.subunit} onChange={(e) => updateCartField(c.lineId, "subunit", e.target.value)}>
                      {(units || []).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="0" value={c.subUnitContains} onChange={(e) => updateCartField(c.lineId, "subUnitContains", parseFloat(e.target.value) || 0)} style={{ width: "100%", boxSizing: "border-box" }} /></td>
                  <td className="mono" style={{ color: "var(--ink-soft)" }}>{subUnitQty(c)}</td>
                  <td><input type="number" min="0" value={c.subUnitRate} onChange={(e) => updateCartField(c.lineId, "subUnitRate", parseFloat(e.target.value) || 0)} style={{ width: "100%", boxSizing: "border-box" }} /></td>
                  <td style={{ textAlign: "right" }} className="mono">{fmt(lineTotal(c))}</td>
                  <td><button className="iconbtn" onClick={() => removeFromCart(c.lineId)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="fuse"><div className="dash" /><div className="dot" /><div className="dash" /></div>

        <div className="split-two-14">
          <div className="field"><label>Discount %</label><input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></div>
          <div className="field"><label>Extra Charges</label><input type="number" min="0" value={extraCharges} onChange={(e) => setExtraCharges(e.target.value)} /></div>
        </div>

        <div style={{ maxWidth: 320, marginLeft: "auto" }}>
          <div className="totalrow"><span>Sub Total</span><span className="mono">{fmt(subtotal)}</span></div>
          <div className="totalrow"><span>Discount</span><span className="mono">-{fmt(discountAmt)}</span></div>
          <div className="totalrow"><span>Discounted Total</span><span className="mono">{fmt(discountedTotal)}</span></div>
          {settings.gstEnabled && taxType === "intra" && (
            <>
              <div className="totalrow"><span>CGST ({(Number(settings.gstRate) || 0) / 2}%)</span><span className="mono">{fmt(cgstAmt)}</span></div>
              <div className="totalrow"><span>SGST ({(Number(settings.gstRate) || 0) / 2}%)</span><span className="mono">{fmt(sgstAmt)}</span></div>
            </>
          )}
          {settings.gstEnabled && taxType === "inter" && (
            <div className="totalrow"><span>IGST ({settings.gstRate}%)</span><span className="mono">{fmt(igstAmt)}</span></div>
          )}
          <div className="totalrow"><span>Extra Charges</span><span className="mono">{fmt(Number(extraCharges) || 0)}</span></div>
          <div className="totalrow grand"><span>Total</span><span className="mono">{fmt(grandTotal)}</span></div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="primarybtn" disabled={cart.length === 0} onClick={saveQuotation}>Save quotation <ArrowRight size={15} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 8 }}>
          A quotation doesn't affect stock. Convert it to an estimate from the Quotations tab once the customer confirms.
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

function AgentsTab({ agents, addAgent, deleteAgent, invoices }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [commissionPct, setCommissionPct] = useState(0);

  function submit() {
    if (!name.trim()) return;
    addAgent({ name: name.trim(), mobile: mobile.trim(), commissionPct: Number(commissionPct) || 0 });
    setName(""); setMobile(""); setCommissionPct(0);
  }

  const stats = useMemo(() => {
    const map = {};
    (invoices || []).forEach((inv) => {
      if (!inv.agentId) return;
      if (!map[inv.agentId]) map[inv.agentId] = { sales: 0, count: 0 };
      map[inv.agentId].sales += inv.total;
      map[inv.agentId].count += 1;
    });
    return map;
  }, [invoices]);

  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Agents</div></div>
      <div className="panel">
        <h3>Add agent</h3>
        <div className="formgrid" style={{ marginBottom: 10 }}>
          <div className="field"><label>Agent name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kannan - Sattur" /></div>
          <div className="field"><label>Mobile number</label><input value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
          <div className="field"><label>Commission %</label><input type="number" min="0" max="100" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} /></div>
        </div>
        <button className="primarybtn" style={{ width: "auto", padding: "9px 18px" }} onClick={submit}>Add agent</button>
      </div>
      <div className="panel">
        {agents.length === 0 ? <div className="emptystate">No agents yet.</div> : (
          <table>
            <thead><tr><th>Agent name</th><th>Mobile</th><th>Commission</th><th>Bills</th><th>Sales</th><th>Commission earned</th><th></th></tr></thead>
            <tbody>
              {agents.map((a) => {
                const s = stats[a.id] || { sales: 0, count: 0 };
                const earned = (s.sales * (a.commissionPct || 0)) / 100;
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td>{a.mobile}</td>
                    <td>{a.commissionPct || 0}%</td>
                    <td>{s.count}</td>
                    <td className="mono">{fmt(s.sales)}</td>
                    <td className="mono">{fmt(earned)}</td>
                    <td><button className="iconbtn" onClick={() => deleteAgent(a.id)}><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
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
            <thead><tr><th>Party name</th><th>Phone</th><th>Identification</th><th>Type</th><th>Orders</th><th>Avg order</th><th>Last purchase</th><th>Balance due</th><th></th></tr></thead>
            <tbody>
              {customers.map((c) => {
                const history = invoices.filter((i) => i.customerId === c.id);
                const totalSpent = history.reduce((s, h) => s + h.total, 0);
                const avgOrder = history.length ? totalSpent / history.length : 0;
                const lastPurchase = history.length ? history.reduce((latest, h) => (h.date > latest ? h.date : latest), history[0].date) : null;
                const ef = editForm[c.id] || { location: c.location || "", identType: c.identType || "GSTIN", identValue: c.identValue || "" };
                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                      <td style={{ fontWeight: 500 }}>{c.name}{c.location ? ` - ${c.location}` : ""}</td>
                      <td>{c.phone}</td>
                      <td style={{ fontSize: 12 }}>{c.identType && c.identValue ? `${c.identType}: ${c.identValue}` : "—"}</td>
                      <td><span className={`badge ${c.type}`}>{c.type}</span></td>
                      <td>{history.length}</td>
                      <td className="mono">{fmt(avgOrder)}</td>
                      <td style={{ fontSize: 12 }}>{lastPurchase || "—"}</td>
                      <td className="mono" style={{ color: c.balanceDue > 0 ? "#A32D2D" : "var(--ink)" }}>{fmt(c.balanceDue || 0)}</td>
                      <td><button className="iconbtn" onClick={(e) => { e.stopPropagation(); deleteCustomer(c.id); }}><Trash2 size={14} /></button></td>
                    </tr>
                    {expanded === c.id && (
                      <tr><td colSpan={9}>
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
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Lifetime value: <span className="mono">{fmt(totalSpent)}</span></div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Purchase history</div>
                          {history.length === 0 ? <div className="emptystate">No purchases yet.</div> : history.map((h) => (
                            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}>
                              <span>{h.invoiceNo} • {h.date}{h.createdByUserName ? ` • by ${h.createdByUserName}` : ""}</span><span className="mono">{fmt(h.total)}</span>
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

function ProformasTab({ proformas, setViewProforma }) {
  function exportProformas() {
    const rows = proformas.map((p) => ({
      Proforma: p.proformaNo, Date: p.date, SourceEstimate: p.sourceInvoiceNo, Customer: p.customerName,
      Total: p.total,
    }));
    downloadXlsx(rows, "proformas.xlsx", "Proformas");
  }
  return (
    <>
      <div className="topbar"><div className="pagetitle disp">Proformas</div>
        <button className="ghostbtn" onClick={exportProformas} disabled={proformas.length === 0}><Download size={14} /> Export Excel</button>
      </div>
      <div className="panel">
        {proformas.length === 0 ? (
          <div className="emptystate">No proformas yet. Generate one from Estimates when you need to fix a mistake on a bill.</div>
        ) : (
          <table>
            <thead><tr><th>Proforma</th><th>Date</th><th>From estimate</th><th>Customer</th><th style={{ textAlign: "right" }}>Total</th><th></th></tr></thead>
            <tbody>
              {proformas.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.proformaNo}</td>
                  <td>{p.date}</td>
                  <td className="mono">{p.sourceInvoiceNo}</td>
                  <td>{p.customerName}</td>
                  <td style={{ textAlign: "right" }} className="mono">{fmt(p.total)}</td>
                  <td><button className="iconbtn" onClick={() => setViewProforma(p)}><FileText size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function InvoicesTab({ invoices, setViewInvoice, generateProformaFromInvoice, units }) {
  const [editingId, setEditingId] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editDiscountPct, setEditDiscountPct] = useState(0);
  const [editExtraCharges, setEditExtraCharges] = useState(0);

  function exportInvoices() {
    const rows = invoices.map((inv) => ({
      Invoice: inv.invoiceNo, Date: inv.date, Customer: inv.customerName, Phone: inv.customerPhone,
      Type: inv.customerType, Subtotal: inv.subtotal, Discount: inv.discountAmt,
      CGST: inv.cgstAmt || 0, SGST: inv.sgstAmt || 0, Total: inv.total, PaymentMode: inv.paymentMode, BalanceDue: inv.balanceDue || 0,
    }));
    downloadXlsx(rows, "invoices.xlsx", "Invoices");
  }

  function startEditForProforma(inv) {
    setEditingId(inv.id);
    setEditItems(inv.items.map((it) => ({ ...it })));
    setEditDiscountPct(inv.discountPct || 0);
    setEditExtraCharges(inv.extraCharges || 0);
  }
  function updateEditItem(idx, field, value) {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
  function submitProforma(inv) {
    generateProformaFromInvoice(inv, editItems, editDiscountPct, editExtraCharges);
    setEditingId(null);
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
                        <button className="iconbtn" title="View" onClick={() => setViewInvoice(inv)}><FileText size={14} /></button>
                        <button className="iconbtn" title="Fix a mistake — convert to Proforma" onClick={() => startEditForProforma(inv)}><Pencil size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  {editingId === inv.id && (
                    <tr><td colSpan={7}>
                      <div style={{ padding: "10px 4px" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Fix a mistake in {inv.invoiceNo}</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 10 }}>
                          Edit whatever's wrong below, then generate a corrected Proforma Invoice. The original estimate, stock and accounts are not changed.
                        </div>
                        <table className="billtable">
                          <thead>
                            <tr>
                              <th>Product</th><th style={{ width: 70 }}>Quantity</th><th style={{ width: 90 }}>Unit</th>
                              <th style={{ width: 110 }}>Sub Unit</th><th style={{ width: 90 }}>Sub Unit Contains</th>
                              <th style={{ width: 90 }}>Sub Unit Rate</th><th style={{ width: 90, textAlign: "right" }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editItems.map((it, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 500 }}>{it.name}</td>
                                <td><input type="number" min="0" value={it.qty} onChange={(e) => updateEditItem(idx, "qty", parseFloat(e.target.value) || 0)} style={{ width: "100%", boxSizing: "border-box" }} /></td>
                                <td>
                                  <select value={it.unit} onChange={(e) => updateEditItem(idx, "unit", e.target.value)}>
                                    {(units || ["Case"]).map((u) => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                </td>
                                <td>
                                  <select value={it.subunit} onChange={(e) => updateEditItem(idx, "subunit", e.target.value)}>
                                    {(units || []).map((u) => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                </td>
                                <td><input type="number" min="0" value={it.subUnitContains} onChange={(e) => updateEditItem(idx, "subUnitContains", parseFloat(e.target.value) || 0)} style={{ width: "100%", boxSizing: "border-box" }} /></td>
                                <td><input type="number" min="0" value={it.subUnitRate} onChange={(e) => updateEditItem(idx, "subUnitRate", parseFloat(e.target.value) || 0)} style={{ width: "100%", boxSizing: "border-box" }} /></td>
                                <td style={{ textAlign: "right" }} className="mono">{fmt(lineTotal(it))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="formgrid" style={{ maxWidth: 400, marginTop: 10 }}>
                          <div className="field"><label>Discount %</label><input type="number" min="0" max="100" value={editDiscountPct} onChange={(e) => setEditDiscountPct(e.target.value)} /></div>
                          <div className="field"><label>Extra Charges</label><input type="number" min="0" value={editExtraCharges} onChange={(e) => setEditExtraCharges(e.target.value)} /></div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button className="primarybtn" style={{ width: "auto", padding: "9px 18px" }} onClick={() => submitProforma(inv)}>Generate Proforma <ArrowRight size={15} /></button>
                          <button className="ghostbtn" onClick={() => setEditingId(null)}>Cancel</button>
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

function ReportsTab({ invoices, products, agents, users }) {
  const topProducts = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => inv.items.forEach((it) => {
      map[it.name] = (map[it.name] || 0) + (Number(it.qty) || 0) * (Number(it.subUnitContains) || 1);
    }));
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
      if (!map[key]) map[key] = { subunit: key, unitsSold: 0, revenue: 0 };
      map[key].unitsSold += (Number(it.qty) || 0) * (Number(it.subUnitContains) || 1);
      map[key].revenue += it.total;
    }));
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [invoices]);

  const agentPerformance = useMemo(() => {
    return (agents || []).map((a) => {
      const agentInvoices = invoices.filter((i) => i.agentId === a.id);
      const sales = agentInvoices.reduce((s, i) => s + i.total, 0);
      return { name: a.name, mobile: a.mobile, bills: agentInvoices.length, sales, commissionPct: a.commissionPct || 0, commission: (sales * (a.commissionPct || 0)) / 100 };
    }).filter((a) => a.bills > 0).sort((a, b) => b.sales - a.sales);
  }, [agents, invoices]);

  const staffPerformance = useMemo(() => {
    return (users || []).map((u) => {
      const userInvoices = invoices.filter((i) => i.createdByUserId === u.id);
      const sales = userInvoices.reduce((s, i) => s + i.total, 0);
      return { name: u.name, bills: userInvoices.length, sales };
    }).filter((u) => u.bills > 0).sort((a, b) => b.sales - a.sales);
  }, [users, invoices]);

  const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
  const totalCost = invoices.reduce((s, i) => s + i.items.reduce((s2, it) => s2 + it.qty * (it.costPrice || 0), 0), 0);
  const profit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  function exportAgentPerformance() {
    downloadXlsx(agentPerformance.map((a) => ({ Agent: a.name, Mobile: a.mobile, Bills: a.bills, Sales: a.sales, CommissionPct: a.commissionPct, CommissionEarned: a.commission })), "agent_performance.xlsx", "Agents");
  }
  function exportStaffPerformance() {
    downloadXlsx(staffPerformance.map((u) => ({ Staff: u.name, Bills: u.bills, Sales: u.sales })), "staff_performance.xlsx", "Staff");
  }

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
    const rows = salesBySubunit.map((s) => ({ Subunit: s.subunit, "Units sold": s.unitsSold, Revenue: s.revenue }));
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
                <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }} barCategoryGap="25%">
                  <CartesianGrid stroke="#E5DDCB" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="qty" name="Qty sold" fill="#D6431F" maxBarSize={22} radius={[0, 3, 3, 0]} />
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
                <BarChart data={monthly} barCategoryGap="35%">
                  <CartesianGrid stroke="#E5DDCB" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#B07C1F" maxBarSize={44} radius={[3, 3, 0, 0]} />
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
                <BarChart data={salesBySubunit} barCategoryGap="30%">
                  <CartesianGrid stroke="#E5DDCB" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="subunit" tick={{ fontSize: 11, fill: "#756B5D" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#756B5D" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#D6431F" maxBarSize={44} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table>
              <thead><tr><th>Subunit</th><th>Units sold</th><th style={{ textAlign: "right" }}>Revenue</th></tr></thead>
              <tbody>
                {salesBySubunit.map((s) => (
                  <tr key={s.subunit}>
                    <td><span className="badge ok">{s.subunit}</span></td>
                    <td>{s.unitsSold} {s.subunit}</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmt(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="split-two">
        <div className="panel" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Agent performance</h3>
            <button className="ghostbtn" onClick={exportAgentPerformance} disabled={agentPerformance.length === 0}><Download size={14} /> Export</button>
          </div>
          {agentPerformance.length === 0 ? <div className="emptystate">No agent-linked sales yet.</div> : (
            <table>
              <thead><tr><th>Agent</th><th>Bills</th><th>Sales</th><th>Comm%</th><th style={{ textAlign: "right" }}>Earned</th></tr></thead>
              <tbody>
                {agentPerformance.map((a) => (
                  <tr key={a.name}>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td>{a.bills}</td>
                    <td className="mono">{fmt(a.sales)}</td>
                    <td>{a.commissionPct}%</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmt(a.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Staff performance</h3>
            <button className="ghostbtn" onClick={exportStaffPerformance} disabled={staffPerformance.length === 0}><Download size={14} /> Export</button>
          </div>
          {staffPerformance.length === 0 ? <div className="emptystate">No staff-attributed sales yet.</div> : (
            <table>
              <thead><tr><th>Staff</th><th>Bills</th><th style={{ textAlign: "right" }}>Sales</th></tr></thead>
              <tbody>
                {staffPerformance.map((u) => (
                  <tr key={u.name}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td>{u.bills}</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmt(u.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
          <>
            <div className="field" style={{ maxWidth: 200 }}>
              <label>GST rate %</label>
              <input type="number" value={local.gstRate} onChange={(e) => setLocal({ ...local, gstRate: e.target.value })} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6 }}>
              This rate is split into CGST + SGST (half each) on every bill.
            </div>
          </>
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
  const isProforma = kind === "proforma";
  const paymentStatus = isEstimate ? (doc.balanceDue > 0 ? (doc.amountPaid > 0 ? "PARTIAL" : "PENDING") : "PAID") : null;
  const docNo = isEstimate ? doc.invoiceNo : isProforma ? doc.proformaNo : doc.quoteNo;
  const docLabel = isEstimate ? "Invoice No" : isProforma ? "Proforma No" : "Quote No";
  const titleText = isEstimate ? "ESTIMATE BILL" : isProforma ? "PROFORMA INVOICE" : "QUOTATION";

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
          <div className="est-label">{isEstimate || isProforma ? "BILL TO" : "QUOTE FOR"}</div>
          <div className="est-name">{doc.customerName}</div>
          {doc.customerPhone && <div className="est-line">Mobile: {doc.customerPhone}</div>}
          <span className={`badge ${doc.customerType}`} style={{ marginTop: 4 }}>{doc.customerType}</span>
        </div>
      </div>

      <div className="est-orderbar">
        <span>{docLabel}: <strong>{docNo}</strong></span>
        {doc.agentName && <span>Agent: <strong>{doc.agentName}</strong></span>}
        <span>Date: <strong>{doc.date}</strong></span>
      </div>

      <table className="est-table">
        <thead><tr><th>SL.N</th><th>Product name</th><th>Qty</th><th>Unit</th><th>Sub Unit</th><th>Rate (Rs.)</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
        <tbody>
          {doc.items.map((it, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{it.name}</td>
              <td>{it.qty}</td>
              <td>{it.unit || "Case"}</td>
              <td>{it.subunit}</td>
              <td>{fmt(it.subUnitRate)}</td>
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
        {doc.discountedTotal != null && <div className="est-totrow"><span>Discounted Total</span><span>{fmt(doc.discountedTotal)}</span></div>}
        {doc.gstEnabled && doc.taxType === "inter" ? (
          <div className="est-totrow"><span>IGST ({doc.igstRate}%)</span><span>{fmt(doc.igstAmt)}</span></div>
        ) : doc.gstEnabled && (
          <>
            <div className="est-totrow"><span>CGST ({doc.cgstRate}%)</span><span>{fmt(doc.cgstAmt)}</span></div>
            <div className="est-totrow"><span>SGST ({doc.sgstRate}%)</span><span>{fmt(doc.sgstAmt)}</span></div>
          </>
        )}
        {doc.extraCharges > 0 && <div className="est-totrow"><span>Extra Charges</span><span>{fmt(doc.extraCharges)}</span></div>}
        <div className="est-totrow grand"><span>Grand total</span><span>{fmt(doc.total)}</span></div>
      </div>

      <div className="est-rule" style={{ margin: "16px 0 10px" }} />
      <div className="est-footer">
        {isEstimate ? (
          <>
            Thank you for your business with {settings.businessName}<br />
            Payment: {doc.paymentMode} ({paymentStatus}){doc.balanceDue > 0 && ` — Balance due ${fmt(doc.balanceDue)}`}
          </>
        ) : isProforma ? (
          <>Revised bill — corrects {doc.sourceInvoiceNo}. For reference only; does not affect stock or accounts.</>
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

const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
* { box-sizing: border-box; }
.app-root {
  --bg: #F7F3EC; --panel: #FFFFFF; --ink: #211C15; --ink-soft: #756B5D;
  --accent: #D6431F; --accent-soft: #F5DCC9; --gold: #B07C1F; --gold-soft: #F1E3C4;
  --green: #3F6B4C; --green-soft: #E1EBDF; --line: #E5DDCB; --sidebar: #211C15; --sidebar-soft: #B8AC98;
  font-family: 'Inter', sans-serif; background: var(--bg); color: var(--ink);
  display: flex; min-height: 100vh; width: 100%; box-sizing: border-box;
}
.disp { font-family: 'Space Grotesk', sans-serif; }
.mono { font-family: 'JetBrains Mono', monospace; }
.sidebar { width: 208px; background: var(--sidebar); color: var(--sidebar-soft); padding: 20px 14px; display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.brand-row { display:flex; align-items:center; gap:8px; padding: 4px 10px 22px; }
.brand-mark { width:10px; height:10px; border-radius:50%; background: var(--accent); box-shadow: 0 0 0 3px rgba(214,67,31,0.25); }
.brand-name { color:#F7F3EC; font-size:15px; font-weight:700; letter-spacing:0.2px; }
.navbtn { display:flex; align-items:center; gap:10px; padding: 9px 12px; border-radius:8px; cursor:pointer; font-size: 12.8px; font-weight: 500; color: var(--sidebar-soft); background: transparent; border: none; text-align:left; width:100%; }
.navbtn:hover { background: rgba(247,243,236,0.08); color:#F7F3EC; }
.navbtn.active { background: var(--accent); color: #FCEFE8; }
.main { flex: 1; padding: 24px 28px; overflow-y: auto; }
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
.entrygrid { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; }
.addicon { background: var(--accent); color: #FDECE4; border-radius: 6px; padding: 6px; flex-shrink: 0; }
.addicon:hover { background: #B93A1B; color: #FDECE4; }
.billtable th { background: var(--sidebar); color: #F1E9D8; }
.billtable input:disabled { background: #EFEAE0; color: var(--ink-soft); }
.emptystate { text-align:center; padding: 30px 10px; color: var(--ink-soft); font-size:13px; }

/* Layout helper classes (replace fragile inline grid-template-columns) */
.cardrow-5 { grid-template-columns: repeat(5, 1fr); }
.cardrow-3 { grid-template-columns: repeat(3, 1fr); }
.split-main { display:grid; grid-template-columns: 1.3fr 1fr; gap:18px; }
.split-two { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
.split-two-14 { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }

/* ===== Responsive: tablet & mobile ===== */
@media (max-width: 900px) {
  .app-root { flex-direction: column; min-height: auto; }
  .sidebar {
    width: 100%; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center;
    padding: 12px; gap: 6px; position: sticky; top: 0; z-index: 10;
  }
  .brand-row { width: 100%; padding: 0 4px 10px; }
  .navbtn { width: auto; flex: 1 1 auto; justify-content: center; font-size: 11.5px; padding: 8px 8px; }
  .main { padding: 16px; }
  .topbar { flex-wrap: wrap; gap: 8px; }
  .cardrow, .cardrow-5, .cardrow-3 { grid-template-columns: repeat(2, 1fr) !important; }
  .split-main, .split-two, .split-two-14, .formgrid, .entrygrid {
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
