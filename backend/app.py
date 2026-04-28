from flask import Flask, abort, jsonify, request
from flask_cors import CORS

from db import (
    create_order,
    create_payment,
    create_shipment,
    get_dashboard_data,
    get_inventory,
    get_order_detail,
    get_orders,
    get_payments,
    get_retailers,
    get_shipments,
    get_status_payload,
    delete_inventory,
    delete_order,
    delete_payment,
    delete_shipment,
    get_table_overview,
    update_inventory,
    update_order,
    update_payment,
    update_shipment,
)


app = Flask(__name__)
CORS(app)


@app.get("/api/health")
def health_check():
    payload = get_status_payload()
    return jsonify(
        {
            "status": "ok",
            "database": payload["source"],
            "connected": payload["connected"],
        }
    )


@app.get("/api/dashboard")
def dashboard():
    return jsonify(get_dashboard_data())


@app.get("/api/orders")
def orders():
    search = request.args.get("search")
    status = request.args.get("status")
    return jsonify(get_orders(search=search, status=status))


@app.get("/api/orders/<int:order_id>")
def order_detail(order_id):
    payload = get_order_detail(order_id)
    if payload is None:
        abort(404, description="Order not found")
    return jsonify(payload)


@app.post("/api/orders")
def create_order_route():
    data = request.get_json(silent=True) or {}
    retailer_id = data.get("retailerId")
    total_amount = data.get("totalAmount")
    order_status = data.get("orderStatus", "Pending")

    if retailer_id is None or total_amount is None:
        return jsonify({"error": "retailerId and totalAmount are required"}), 400

    created = create_order(int(retailer_id), float(total_amount), order_status)
    return jsonify(created), 201


@app.put("/api/orders/<int:order_id>")
def update_order_route(order_id):
    data = request.get_json(silent=True) or {}
    updated = update_order(
        order_id,
        retailer_id=data.get("retailerId"),
        order_status=data.get("orderStatus"),
        total_amount=data.get("totalAmount"),
    )
    if updated is None:
        abort(404, description="Order not found")
    return jsonify(updated)


@app.delete("/api/orders/<int:order_id>")
def delete_order_route(order_id):
    delete_order(order_id)
    return jsonify({"deleted": True})


@app.get("/api/inventory")
def inventory():
    return jsonify(get_inventory())


@app.put("/api/inventory/<int:item_id>")
def update_inventory_route(item_id):
    data = request.get_json(silent=True) or {}
    updated = update_inventory(
        item_id,
        quantity=data.get("quantity"),
        warehouse=data.get("warehouse"),
        low_stock_threshold=data.get("lowStockThreshold"),
    )
    if updated is None:
        abort(404, description="Inventory item not found")
    return jsonify(updated)


@app.delete("/api/inventory/<int:item_id>")
def delete_inventory_route(item_id):
    delete_inventory(item_id)
    return jsonify({"deleted": True})


@app.get("/api/shipments")
def shipments():
    return jsonify(get_shipments())


@app.post("/api/shipments")
def create_shipment_route():
    data = request.get_json(silent=True) or {}
    source = data.get("source")
    destination = data.get("destination")
    shipment_status = data.get("shipmentStatus", "In Transit")

    if not source or not destination:
        return jsonify({"error": "source and destination are required"}), 400

    created = create_shipment(source, destination, shipment_status)
    return jsonify(created), 201


@app.put("/api/shipments/<int:shipment_id>")
def update_shipment_route(shipment_id):
    data = request.get_json(silent=True) or {}
    updated = update_shipment(
        shipment_id,
        source=data.get("source"),
        destination=data.get("destination"),
        shipment_status=data.get("shipmentStatus"),
    )
    if updated is None:
        abort(404, description="Shipment not found")
    return jsonify(updated)


@app.delete("/api/shipments/<int:shipment_id>")
def delete_shipment_route(shipment_id):
    delete_shipment(shipment_id)
    return jsonify({"deleted": True})


@app.get("/api/payments")
def payments():
    return jsonify(get_payments())


@app.post("/api/payments")
def create_payment_route():
    data = request.get_json(silent=True) or {}
    order_id = data.get("orderId")
    amount = data.get("amount")
    status = data.get("status", "Paid")

    if order_id is None or amount is None:
        return jsonify({"error": "orderId and amount are required"}), 400

    created = create_payment(int(order_id), float(amount), status)
    return jsonify(created), 201


@app.delete("/api/payments/<int:payment_id>")
def delete_payment_route(payment_id):
    delete_payment(payment_id)
    return jsonify({"deleted": True})


@app.put("/api/payments/<int:payment_id>")
def update_payment_route(payment_id):
    data = request.get_json(silent=True) or {}
    updated = update_payment(
        payment_id,
        amount=data.get("amount"),
        status=data.get("status"),
    )
    if updated is None:
        abort(404, description="Payment not found")
    return jsonify(updated)


@app.get("/api/retailers")
def retailers():
    return jsonify(get_retailers())


@app.get("/api/table-overview")
def table_overview():
    return jsonify(get_table_overview())


@app.errorhandler(404)
def handle_not_found(error):
    return jsonify({"error": str(error)}), 404


@app.errorhandler(500)
def handle_server_error(error):
    return jsonify({"error": "Internal server error", "details": str(error)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
