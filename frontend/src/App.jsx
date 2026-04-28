import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Database,
  Eye,
  ArrowUpDown,
  DollarSign,
  LayoutDashboard,
  Package2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

import { api } from "./api";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "shipments", label: "Shipments", icon: Truck },
  { key: "payments", label: "Payments", icon: CreditCard },
];

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCurrency(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function badgeClasses(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("pending") || normalized.includes("low")) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }

  if (normalized.includes("processing") || normalized.includes("transit")) {
    return "border-sky-500/20 bg-sky-500/10 text-sky-100";
  }

  if (normalized.includes("shipped")) {
    return "border-cyan-500/20 bg-cyan-500/10 text-cyan-100";
  }

  if (
    normalized.includes("delivered") ||
    normalized.includes("paid") ||
    normalized.includes("healthy") ||
    normalized.includes("ok")
  ) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  }

  if (normalized.includes("failed") || normalized.includes("error")) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-100";
  }

  return "border-slate-500/20 bg-slate-500/10 text-slate-100";
}

function sortRows(rows, sortKey, sortDirection) {
  const factor = sortDirection === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = left?.[sortKey];
    const rightValue = right?.[sortKey];

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * factor;
    }

    const leftText = String(leftValue ?? "").toLowerCase();
    const rightText = String(rightValue ?? "").toLowerCase();
    return leftText.localeCompare(rightText, "en", { numeric: true }) * factor;
  });
}

function SupplyChainApp() {
  const [activeView, setActiveView] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [source, setSource] = useState("connecting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState({ type: null, payload: null });
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAllData = async () => {
    setLoading(true);
    setError("");

    try {
      const [healthResult, dashboardResult, ordersResult, inventoryResult, shipmentsResult, paymentsResult, retailersResult] =
        await Promise.allSettled([
          api.health(),
          api.dashboard(),
          api.orders(),
          api.inventory(),
          api.shipments(),
          api.payments(),
          api.retailers(),
        ]);

      if (healthResult.status === "fulfilled") {
        setSource(healthResult.value.database);
      }

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value);
        setSource(dashboardResult.value?.summary?.source || source);
      }

      if (ordersResult.status === "fulfilled") {
        setOrders(ordersResult.value);
      }

      if (inventoryResult.status === "fulfilled") {
        setInventory(inventoryResult.value);
      }

      if (shipmentsResult.status === "fulfilled") {
        setShipments(shipmentsResult.value);
      }

      if (paymentsResult.status === "fulfilled") {
        setPayments(paymentsResult.value);
      }

      if (retailersResult.status === "fulfilled") {
        setRetailers(retailersResult.value);
      }

      const failures = [
        healthResult,
        dashboardResult,
        ordersResult,
        inventoryResult,
        shipmentsResult,
        paymentsResult,
        retailersResult,
      ].filter((result) => result.status === "rejected");

      if (failures.length === 7) {
        throw new Error("The backend API could not be reached.");
      }

      if (failures.length > 0) {
        setToast("Some panels were not refreshed. The rest of the dashboard is still live.");
      }
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load the dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const recentOrders = dashboard?.recentOrders || orders.slice(0, 5);
  const lowStockItems = dashboard?.lowStockItems || inventory.filter((item) => item.isLowStock);
  const summary = dashboard?.summary || {
    totalOrders: orders.length,
    pendingOrders: orders.filter((order) => order.orderStatus === "Pending").length,
    totalRevenue: orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    lowInventoryAlerts: lowStockItems.length,
    inTransitShipments: shipments.filter((shipment) => String(shipment.shipmentStatus).toLowerCase().includes("transit")).length,
    source,
  };

  const modalTitle = useMemo(() => {
    switch (modal.type) {
      case "order-create":
        return "Create Order";
      case "shipment-create":
        return "Create Shipment";
      case "shipment-edit":
        return "Edit Shipment";
      case "inventory-edit":
        return "Update Inventory";
      case "payment-create":
        return "Add Payment";
      case "payment-edit":
        return "Edit Payment";
      case "order-detail":
        return "Order Details";
      default:
        return "";
    }
  }, [modal.type]);

  const activeRetailerOptions = useMemo(() => retailers.length ? retailers : [
    { retailerId: 1, retailerName: "Northwind Traders" },
    { retailerId: 2, retailerName: "Acme Retail" },
    { retailerId: 3, retailerName: "Urban Bazaar" },
  ], [retailers]);

  const openOrderDetails = async (order) => {
    setModal({ type: "order-detail", payload: order });
    setOrderDetail(null);
    setDetailLoading(true);

    try {
      const detail = await api.orderDetail(order.orderId);
      setOrderDetail(detail);
    } catch (detailError) {
      setToast(detailError.message || "Unable to load order details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const openCrudModal = (type, payload = null) => {
    setOrderDetail(null);
    setModal({ type, payload });
  };

  const closeModal = () => {
    setModal({ type: null, payload: null });
    setOrderDetail(null);
  };

  const submitOrderCreate = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await api.createOrder({
      retailerId: Number(formData.get("retailerId")),
      totalAmount: Number(formData.get("totalAmount")),
      orderStatus: formData.get("orderStatus"),
    });

    setToast("Order saved to MySQL.");
    closeModal();
    await loadAllData();
  };

  const submitInventoryEdit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await api.updateInventory(modal.payload.itemId, {
      quantity: Number(formData.get("quantity")),
      warehouse: formData.get("warehouse"),
      lowStockThreshold: Number(formData.get("lowStockThreshold")),
    });

    setToast("Inventory updated in MySQL.");
    closeModal();
    await loadAllData();
  };

  const submitPaymentForm = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    const status = formData.get("paymentStatus");

    if (modal.type === "payment-edit") {
      await api.updatePayment(modal.payload.paymentId, { amount, status });
      setToast(`Payment #${modal.payload.paymentId} updated.`);
    } else {
      await api.createPayment({
        orderId: Number(formData.get("orderId")),
        amount,
        status,
      });
      setToast("Payment saved to MySQL.");
    }

    closeModal();
    await loadAllData();
  };

  const submitShipmentForm = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      source: formData.get("source"),
      destination: formData.get("destination"),
      shipmentStatus: formData.get("shipmentStatus"),
    };

    if (modal.type === "shipment-edit") {
      await api.updateShipment(modal.payload.shipmentId, payload);
      setToast(`Shipment #${modal.payload.shipmentId} updated.`);
    } else {
      await api.createShipment(payload);
      setToast("Shipment saved to MySQL.");
    }

    closeModal();
    await loadAllData();
  };

  const updateOrderStatus = async (order) => {
    const nextStatusMap = {
      Pending: "Processing",
      Processing: "Shipped",
      Shipped: "Delivered",
      Delivered: "Delivered",
    };

    await api.updateOrder(order.orderId, { orderStatus: nextStatusMap[order.orderStatus] || "Processing" });
    setToast(`Order #${order.orderId} status updated.`);
    await loadAllData();
  };

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-4 rounded-[28px] border border-white/10 bg-[var(--panel)] p-4 shadow-soft backdrop-blur-2xl">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-sky-100">
                <Database className="h-3.5 w-3.5" />
                Supply Chain Dashboard
              </div>
              <h1 className="mt-4 font-['Space_Grotesk'] text-2xl font-bold leading-tight text-white">
                Live operations from MySQL.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Track the order-to-payment workflow with real database records and readable business views.
              </p>
            </div>

            <nav className="mt-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveView(item.key)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                      active
                        ? "border-sky-400/30 bg-sky-400/10 text-white shadow-lg shadow-sky-500/10"
                        : "border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className={cx("h-4.5 w-4.5", active ? "text-sky-300" : "text-slate-400")} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Quick facts</p>
              <div className="mt-3 space-y-3 text-sm text-slate-200">
                <QuickFact label="Total Orders" value={summary.totalOrders} />
                <QuickFact label="Pending Orders" value={summary.pendingOrders} />
                <QuickFact label="Low Inventory Alerts" value={summary.lowInventoryAlerts} />
                <QuickFact label="Shipments In Transit" value={shipments.filter((shipment) => String(shipment.shipmentStatus).toLowerCase().includes("transit")).length} />
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <header className="rounded-[28px] border border-white/10 bg-[var(--panel)] px-5 py-4 shadow-soft backdrop-blur-2xl lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2">
                <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-white lg:text-4xl">
                  Dashboard
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-300 lg:text-base">
                  Manage orders, inventory, shipments, and payments across the full business flow without exposing raw database tables.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StatusPill label={source === "mysql" ? "Live MySQL" : "Local Fallback"} tone={source === "mysql" ? "emerald" : "amber"} icon={source === "mysql" ? CheckCircle2 : AlertTriangle} />
                <button
                  type="button"
                  onClick={loadAllData}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
                  Refresh
                </button>
              </div>
            </div>
          </header>

          <div className="lg:hidden">
            <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-[var(--panel)] p-2 shadow-soft backdrop-blur-2xl">
              <div className="flex min-w-max gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveView(item.key)}
                      className={cx(
                        "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition",
                        active ? "bg-sky-400/15 text-white" : "bg-white/5 text-slate-300",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
          {error ? <ErrorBanner message={error} onRetry={loadAllData} /> : null}

          <section>
            {loading && !dashboard ? <LoadingState /> : null}

            {activeView === "dashboard" ? (
              <DashboardPage
                summary={summary}
                recentOrders={recentOrders}
                lowStockItems={lowStockItems}
                onNavigate={setActiveView}
              />
            ) : null}

            {activeView === "orders" ? (
              <OrdersPage
                orders={orders}
                onInspectOrder={openOrderDetails}
                onOpenCreateOrder={() => openCrudModal("order-create")}
                onUpdateStatus={updateOrderStatus}
              />
            ) : null}

            {activeView === "inventory" ? (
              <InventoryPage
                inventory={inventory}
                onEditItem={(item) => openCrudModal("inventory-edit", item)}
              />
            ) : null}

            {activeView === "shipments" ? (
              <ShipmentsPage
                shipments={shipments}
                onOpenCreateShipment={() => openCrudModal("shipment-create")}
                onEditShipment={(shipment) => openCrudModal("shipment-edit", shipment)}
              />
            ) : null}

            {activeView === "payments" ? (
              <PaymentsPage
                payments={payments}
                onAddPayment={() => openCrudModal("payment-create")}
                onEditPayment={(payment) => openCrudModal("payment-edit", payment)}
              />
            ) : null}
          </section>
        </main>
      </div>

      {modal.type ? (
        <Modal title={modalTitle} onClose={closeModal}>
          {modal.type === "order-detail" ? (
            <OrderDetailModal loading={detailLoading} detail={orderDetail} fallbackOrder={modal.payload} />
          ) : null}

          {modal.type === "order-create" ? (
            <DemoForm
              title="Create a new order"
              description="Create a live order record in MySQL."
              onSubmit={submitOrderCreate}
              onClose={closeModal}
            >
              <Field label="Retailer">
                <select name="retailerId" className="input-base" defaultValue="">
                  <option value="" disabled>
                    Select retailer
                  </option>
                  {activeRetailerOptions.map((retailer) => (
                    <option key={retailer.retailerId} value={retailer.retailerId}>
                      {retailer.retailerName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Total amount">
                <input name="totalAmount" className="input-base" type="number" step="0.01" placeholder="0.00" />
              </Field>
              <Field label="Status">
                <select name="orderStatus" className="input-base" defaultValue="Pending">
                  <option>Pending</option>
                  <option>Processing</option>
                  <option>Shipped</option>
                  <option>Delivered</option>
                </select>
              </Field>
            </DemoForm>
          ) : null}

          {(modal.type === "shipment-create" || modal.type === "shipment-edit") ? (
            <DemoForm
              title={modal.type === "shipment-edit" ? `Update shipment ${modal.payload?.shipmentId ?? ""}` : "Create a new shipment"}
              description={modal.type === "shipment-edit" ? "Edit the shipment route and status in MySQL." : "Add shipment movement directly into MySQL from the frontend."}
              onSubmit={submitShipmentForm}
              onClose={closeModal}
            >
              <Field label="Source">
                <input name="source" className="input-base" placeholder="Warehouse A" defaultValue={modal.payload?.source ?? ""} />
              </Field>
              <Field label="Destination">
                <input name="destination" className="input-base" placeholder="Retailer or city" defaultValue={modal.payload?.destination ?? ""} />
              </Field>
              <Field label="Status">
                <select name="shipmentStatus" className="input-base" defaultValue={modal.payload?.shipmentStatus ?? "In Transit"}>
                  <option>Created</option>
                  <option>In Transit</option>
                  <option>Delivered</option>
                </select>
              </Field>
            </DemoForm>
          ) : null}

          {modal.type === "inventory-edit" ? (
            <DemoForm
              title={`Update stock for item ${modal.payload?.itemId ?? ""}`}
              description="Persist the stock update directly to MySQL."
              onSubmit={submitInventoryEdit}
              onClose={closeModal}
            >
              <Field label="Current quantity">
                <input name="quantity" className="input-base" type="number" defaultValue={modal.payload?.quantity ?? 0} />
              </Field>
              <Field label="Warehouse">
                <input name="warehouse" className="input-base" defaultValue={modal.payload?.warehouse ?? ""} />
              </Field>
              <Field label="Low stock threshold">
                <input name="lowStockThreshold" className="input-base" type="number" defaultValue={modal.payload?.lowStockThreshold ?? 0} />
              </Field>
            </DemoForm>
          ) : null}

          {(modal.type === "payment-create" || modal.type === "payment-edit") ? (
            <DemoForm
              title={modal.type === "payment-edit" ? `Update payment ${modal.payload?.paymentId ?? ""}` : "Record a payment"}
              description={modal.type === "payment-edit" ? "Update the payment amount or status in MySQL." : "Record a live payment against an order."}
              onSubmit={submitPaymentForm}
              onClose={closeModal}
            >
              {modal.type === "payment-create" ? (
                <Field label="Order">
                  <select name="orderId" className="input-base" defaultValue="">
                    <option value="" disabled>
                      Select order
                    </option>
                    {orders.map((order) => (
                      <option key={order.orderId} value={order.orderId}>
                        {order.orderId} - {order.retailerName}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Amount">
                <input name="amount" className="input-base" type="number" step="0.01" placeholder="0.00" defaultValue={modal.payload?.amount ?? ""} />
              </Field>
              <Field label="Status">
                <select name="paymentStatus" className="input-base" defaultValue={modal.payload?.status ?? "Paid"}>
                  <option>Paid</option>
                  <option>Pending</option>
                  <option>Failed</option>
                </select>
              </Field>
            </DemoForm>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function DashboardPage({ summary, recentOrders, lowStockItems, onNavigate }) {
  const cards = [
    {
      label: "Total Orders",
      value: numberFormatter.format(summary.totalOrders || 0),
      description: "All orders tracked in the system.",
      icon: ShoppingCart,
      tone: "sky",
    },
    {
      label: "Pending Orders",
      value: numberFormatter.format(summary.pendingOrders || 0),
      description: "Orders waiting on processing or dispatch.",
      icon: ArrowUpDown,
      tone: "amber",
    },
    {
      label: "Total Revenue",
      value: formatCurrency(summary.totalRevenue || 0),
      description: "Gross value of order volume.",
      icon: DollarSign,
      tone: "emerald",
    },
    {
      label: "Low Inventory Alerts",
      value: numberFormatter.format(summary.lowInventoryAlerts || 0),
      description: "Items below threshold.",
      icon: AlertTriangle,
      tone: "rose",
    },
    {
      label: "Shipments In Transit",
      value: numberFormatter.format(summary.inTransitShipments || 0),
      description: "Shipments currently moving through the network.",
      icon: Truck,
      tone: "sky",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <SectionCard
          title="Recent orders"
          subtitle="Live order activity with retailer joins"
          action={
            <button
              type="button"
              onClick={() => onNavigate("orders")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
            >
              Open Orders
              <ArrowRight className="h-4 w-4" />
            </button>
          }
        >
          <DataTable
            columns={[
              { key: "orderId", label: "Order ID", sortable: true },
              { key: "retailerName", label: "Retailer", sortable: true },
              { key: "orderStatus", label: "Status", sortable: true },
              { key: "totalAmount", label: "Amount", sortable: true },
            ]}
            rows={recentOrders}
            sortKey="orderId"
            sortDirection="desc"
            emptyMessage="No recent orders to display."
            rowRenderer={(row) => ({
              orderId: `#${row.orderId}`,
              retailerName: row.retailerName,
              orderStatus: <StatusBadge value={row.orderStatus} />,
              totalAmount: formatCurrency(row.totalAmount),
            })}
          />
        </SectionCard>

        <SectionCard
          title="Low stock alerts"
          subtitle="Items below threshold need attention"
          action={<StatusPill label={`${lowStockItems.length} alerts`} tone="rose" icon={AlertTriangle} />}
        >
          <div className="space-y-3">
            {lowStockItems.length === 0 ? (
              <EmptyState title="All inventory is healthy" description="No items are currently below the configured threshold." />
            ) : (
              lowStockItems.map((item) => (
                <div key={item.itemId} className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Item {item.itemId}</p>
                      <p className="mt-1 text-sm text-slate-300">{item.itemName || "Inventory item"}</p>
                    </div>
                    <StatusBadge value="Low Stock" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
                    <InfoChip label="Quantity" value={item.quantity} />
                    <InfoChip label="Warehouse" value={item.warehouse} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

    </div>
  );
}

function OrdersPage({ orders, onInspectOrder, onOpenCreateOrder, onUpdateStatus }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("orderId");
  const [sortDirection, setSortDirection] = useState("desc");

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      const searchMatch =
        !normalizedSearch ||
        String(order.orderId).includes(normalizedSearch) ||
        order.retailerName.toLowerCase().includes(normalizedSearch) ||
        order.orderStatus.toLowerCase().includes(normalizedSearch);

      const statusMatch = statusFilter === "all" || order.orderStatus === statusFilter;

      return searchMatch && statusMatch;
    });

    return sortRows(filtered, sortKey, sortDirection);
  }, [orders, search, statusFilter, sortKey, sortDirection]);

  const columns = [
    { key: "orderId", label: "Order ID", sortable: true },
    { key: "retailerName", label: "Retailer Name", sortable: true },
    { key: "orderStatus", label: "Order Status", sortable: true },
    { key: "totalAmount", label: "Total Amount", sortable: true },
    { key: "actions", label: "Actions", sortable: false },
  ];

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <SectionCard
      title="Orders management"
      subtitle="Retailer joins and order lifecycle in one view"
      action={
        <button
          type="button"
          onClick={onOpenCreateOrder}
          className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/15"
        >
          <Plus className="h-4 w-4" />
          Create order
        </button>
      }
    >
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-base pl-11"
            placeholder="Search by order id, retailer, or status"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-base w-44">
            <option value="all">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        emptyMessage="No orders match the current filters."
        rowRenderer={(row) => ({
          orderId: `#${row.orderId}`,
          retailerName: row.retailerName,
          orderStatus: <StatusBadge value={row.orderStatus} />,
          totalAmount: formatCurrency(row.totalAmount),
          actions: (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onInspectOrder(row)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(row)}
                className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-50 transition hover:bg-sky-400/15"
              >
                Update
              </button>
            </div>
          ),
        })}
      />
    </SectionCard>
  );
}

function InventoryPage({ inventory, onEditItem }) {
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [sortKey, setSortKey] = useState("itemId");
  const [sortDirection, setSortDirection] = useState("asc");

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = inventory.filter((item) => {
      const searchMatch =
        !normalizedSearch ||
        String(item.itemId).includes(normalizedSearch) ||
        String(item.itemName || "").toLowerCase().includes(normalizedSearch) ||
        String(item.warehouse || "").toLowerCase().includes(normalizedSearch);

      const lowStockMatch = !onlyLowStock || item.isLowStock;

      return searchMatch && lowStockMatch;
    });

    return sortRows(filtered, sortKey, sortDirection);
  }, [inventory, search, onlyLowStock, sortKey, sortDirection]);

  const columns = [
    { key: "itemId", label: "Item ID", sortable: true },
    { key: "quantity", label: "Quantity", sortable: true },
    { key: "warehouse", label: "Warehouse", sortable: true },
    { key: "status", label: "Stock Status", sortable: false },
    { key: "actions", label: "Actions", sortable: false },
  ];

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <SectionCard title="Inventory visibility" subtitle="Low stock highlights appear in red for quick action">
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-base pl-11"
            placeholder="Search item id, warehouse, or item name"
          />
        </div>

        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(event) => setOnlyLowStock(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-transparent text-sky-400"
          />
          Show only low stock
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        emptyMessage="No inventory rows match the selected filters."
        rowRenderer={(row) => ({
          itemId: `#${row.itemId}`,
          quantity: <span className={cx(row.isLowStock ? "text-rose-200" : "text-white")}>{row.quantity}</span>,
          warehouse: row.warehouse,
          status: <StatusBadge value={row.isLowStock ? "Low Stock" : "Healthy"} />,
          actions: (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEditItem(row)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
              >
                <Package2 className="h-4 w-4" />
                Update
              </button>
            </div>
          ),
        })}
      />
    </SectionCard>
  );
}

function ShipmentsPage({ shipments, onOpenCreateShipment, onEditShipment }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("shipmentId");
  const [sortDirection, setSortDirection] = useState("desc");

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = shipments.filter((shipment) => {
      return (
        !normalizedSearch ||
        String(shipment.shipmentId).includes(normalizedSearch) ||
        String(shipment.source || "").toLowerCase().includes(normalizedSearch) ||
        String(shipment.destination || "").toLowerCase().includes(normalizedSearch) ||
        String(shipment.shipmentStatus || "").toLowerCase().includes(normalizedSearch)
      );
    });

    return sortRows(filtered, sortKey, sortDirection);
  }, [shipments, search, sortKey, sortDirection]);

  const columns = [
    { key: "shipmentId", label: "Shipment ID", sortable: true },
    { key: "route", label: "Route", sortable: false },
    { key: "shipmentStatus", label: "Shipment Status", sortable: true },
    { key: "actions", label: "Actions", sortable: false },
  ];

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <SectionCard
      title="Shipment tracking"
      subtitle="Route and status indicators for movement across the network"
      action={
        <button
          type="button"
          onClick={onOpenCreateShipment}
          className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/15"
        >
          <Plus className="h-4 w-4" />
          Create shipment
        </button>
      }
    >
      <div className="mb-5 relative w-full xl:max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="input-base pl-11"
          placeholder="Search by shipment id, route, or status"
        />
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        emptyMessage="No shipments match the current filters."
        rowRenderer={(row) => ({
          shipmentId: `#${row.shipmentId}`,
          route: (
            <div className="flex items-center gap-2 text-slate-200">
              <Warehouse className="h-4 w-4 text-slate-400" />
              <span>
                {row.source} <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> {row.destination}
              </span>
            </div>
          ),
          shipmentStatus: <StatusBadge value={row.shipmentStatus} />,
          actions: (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEditShipment(row)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Edit
              </button>
            </div>
          ),
        })}
      />
    </SectionCard>
  );
}

function PaymentsPage({ payments, onAddPayment, onEditPayment }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("paymentId");
  const [sortDirection, setSortDirection] = useState("desc");

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = payments.filter((payment) => {
      return (
        !normalizedSearch ||
        String(payment.paymentId).includes(normalizedSearch) ||
        String(payment.orderId).includes(normalizedSearch) ||
        String(payment.status || "").toLowerCase().includes(normalizedSearch)
      );
    });

    return sortRows(filtered, sortKey, sortDirection);
  }, [payments, search, sortKey, sortDirection]);

  const columns = [
    { key: "paymentId", label: "Payment ID", sortable: true },
    { key: "orderId", label: "Order ID", sortable: true },
    { key: "amount", label: "Amount", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "actions", label: "Actions", sortable: false },
  ];

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <SectionCard
      title="Payments"
      subtitle="Track order-level payments and collection status"
      action={
        <button
          type="button"
          onClick={onAddPayment}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
        >
          <Plus className="h-4 w-4" />
          Add payment
        </button>
      }
    >
      <div className="mb-5 relative w-full xl:max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="input-base pl-11"
          placeholder="Search by payment id, order id, or status"
        />
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        emptyMessage="No payments match the current filters."
        rowRenderer={(row) => ({
          paymentId: `#${row.paymentId}`,
          orderId: `#${row.orderId}`,
          amount: formatCurrency(row.amount),
          status: <StatusBadge value={row.status} />,
          actions: (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEditPayment(row)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Edit
              </button>
            </div>
          ),
        })}
      />
    </SectionCard>
  );
}

function QuickFact({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <span className="font-semibold text-white">{numberFormatter.format(Number(value || 0))}</span>
    </div>
  );
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-[var(--panel)] p-5 shadow-soft backdrop-blur-2xl lg:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-['Space_Grotesk'] text-2xl font-bold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, description, icon: Icon, tone }) {
  const toneStyles = {
    sky: "from-sky-400/20 to-cyan-400/5 text-sky-100 border-sky-400/15",
    amber: "from-amber-400/20 to-orange-400/5 text-amber-100 border-amber-400/15",
    emerald: "from-emerald-400/20 to-teal-400/5 text-emerald-100 border-emerald-400/15",
    rose: "from-rose-400/20 to-pink-400/5 text-rose-100 border-rose-400/15",
  };

  return (
    <div className={cx("rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-soft backdrop-blur-xl", toneStyles[tone] || toneStyles.sky)}>
      <div className="flex h-full min-h-[186px] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400">{label}</p>
            <p className="mt-3 whitespace-nowrap font-['Space_Grotesk'] text-[1.65rem] font-bold leading-none tracking-[-0.04em] text-white lg:text-[1.9rem] xl:text-[2rem]">
              {value}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 shadow-inner shadow-black/20">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="max-w-[18ch] text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function StatusPill({ label, tone, icon: Icon }) {
  const toneMap = {
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-100",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-100",
  };

  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em]", toneMap[tone])}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function StatusBadge({ value }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]", badgeClasses(value))}>
      {value}
    </span>
  );
}

function InfoChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function DataTable({ columns, rows, emptyMessage, rowRenderer, sortKey, sortDirection, onSort }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/45">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              {columns.map((column) => {
                const active = column.sortable && sortKey === column.key;
                const Icon = active ? (sortDirection === "asc" ? ChevronUp : ChevronDown) : ArrowUpDown;
                return (
                  <th key={column.key} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(column.key)}
                        className="inline-flex items-center gap-2 transition hover:text-white"
                      >
                        {column.label}
                        <Icon className={cx("h-4 w-4", active ? "text-sky-300" : "text-slate-500")} />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16">
                  <EmptyState title="No data found" description={emptyMessage} />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const renderedRow = rowRenderer(row);
                return (
                  <tr key={row.orderId || row.itemId || row.shipmentId || row.paymentId} className="transition hover:bg-white/5">
                    {columns.map((column) => (
                      <td key={column.key} className="px-5 py-4 text-sm text-slate-200">
                        {renderedRow[column.key] ?? "-"}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-[var(--panel-strong)] shadow-soft">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 lg:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Workflow modal</p>
            <h4 className="mt-1 font-['Space_Grotesk'] text-2xl font-bold text-white">{title}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-5 lg:px-6">{children}</div>
      </div>
    </div>
  );
}

function OrderDetailModal({ loading, detail, fallbackOrder }) {
  if (loading) {
    return <LoadingState compact label="Loading order detail" />;
  }

  const order = detail?.order || fallbackOrder;
  const relatedPayment = detail?.relatedPayment;
  const relatedShipment = detail?.relatedShipment;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <InfoPanel title="Order ID" value={`#${order?.orderId ?? "-"}`} />
        <InfoPanel title="Retailer" value={order?.retailerName ?? "-"} />
        <InfoPanel title="Status" value={<StatusBadge value={order?.orderStatus ?? "-"} />} />
        <InfoPanel title="Amount" value={formatCurrency(order?.totalAmount ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailBlock title="Shipment">
          {relatedShipment ? (
            <div className="space-y-2 text-sm text-slate-200">
              <p>Shipment ID: #{relatedShipment.shipmentId}</p>
              <p>Route: {relatedShipment.source} to {relatedShipment.destination}</p>
              <StatusBadge value={relatedShipment.shipmentStatus} />
            </div>
          ) : (
            <p className="text-sm text-slate-400">No shipment record is linked yet.</p>
          )}
        </DetailBlock>

        <DetailBlock title="Payment">
          {relatedPayment ? (
            <div className="space-y-2 text-sm text-slate-200">
              <p>Payment ID: #{relatedPayment.paymentId}</p>
              <p>Amount: {formatCurrency(relatedPayment.amount)}</p>
              <StatusBadge value={relatedPayment.status} />
            </div>
          ) : (
            <p className="text-sm text-slate-400">No payment record is linked yet.</p>
          )}
        </DetailBlock>
      </div>
    </div>
  );
}

function DemoForm({ title, description, onSubmit, onClose, children }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h5 className="font-['Space_Grotesk'] text-xl font-bold text-white">{title}</h5>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
      <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          Close
        </button>
        <button
          type="submit"
          className="rounded-2xl border border-sky-400/20 bg-sky-400/15 px-4 py-2.5 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/20"
        >
          Save changes
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function InfoPanel({ title, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <div className="mt-3 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/5 px-6 py-12 text-center">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200">
        <Database className="h-5 w-5" />
      </div>
      <h4 className="mt-4 text-lg font-semibold text-white">{title}</h4>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-soft backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-sky-400/20 bg-sky-400/10 p-2 text-sky-100">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 transition hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="mt-6 rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">Backend connection issue</p>
          <p className="mt-1 text-sm text-rose-100/80">{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full border border-rose-100/20 bg-rose-100/10 px-4 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-100/15"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}

function LoadingState({ compact = false, label = "Loading live dashboard data" }) {
  return (
    <div className={cx("flex flex-col items-center justify-center rounded-[30px] border border-white/10 bg-white/5 px-6 py-16 text-center", compact && "py-10")}>
      <div className="animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-300 p-4">
        <RefreshCw className="h-5 w-5 text-sky-200" />
      </div>
      <p className="mt-4 text-sm text-slate-300">{label}</p>
    </div>
  );
}

export default function App() {
  return <SupplyChainApp />;
}
