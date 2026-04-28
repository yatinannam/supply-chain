const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed for ${path}`);
  }
  return response.json();
}

export const api = {
  health: () => request("/health"),
  dashboard: () => request("/dashboard"),
  orders: () => request("/orders"),
  orderDetail: (orderId) => request(`/orders/${orderId}`),
  createOrder: (payload) => request("/orders", { method: "POST", body: JSON.stringify(payload) }),
  updateOrder: (orderId, payload) => request(`/orders/${orderId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteOrder: (orderId) => request(`/orders/${orderId}`, { method: "DELETE" }),
  inventory: () => request("/inventory"),
  updateInventory: (itemId, payload) => request(`/inventory/${itemId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteInventory: (itemId) => request(`/inventory/${itemId}`, { method: "DELETE" }),
  shipments: () => request("/shipments"),
  createShipment: (payload) => request("/shipments", { method: "POST", body: JSON.stringify(payload) }),
  updateShipment: (shipmentId, payload) => request(`/shipments/${shipmentId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteShipment: (shipmentId) => request(`/shipments/${shipmentId}`, { method: "DELETE" }),
  payments: () => request("/payments"),
  createPayment: (payload) => request("/payments", { method: "POST", body: JSON.stringify(payload) }),
  updatePayment: (paymentId, payload) => request(`/payments/${paymentId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePayment: (paymentId) => request(`/payments/${paymentId}`, { method: "DELETE" }),
  retailers: () => request("/retailers"),
  tableOverview: () => request("/table-overview"),
};
