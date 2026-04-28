from copy import deepcopy


SAMPLE_RETAILERS = [
    {"retailerId": 1, "retailerName": "Northwind Traders"},
    {"retailerId": 2, "retailerName": "Acme Retail"},
    {"retailerId": 3, "retailerName": "Urban Bazaar"},
]

SAMPLE_ORDERS = [
    {
        "orderId": 1001,
        "retailerId": 1,
        "retailerName": "Northwind Traders",
        "orderStatus": "Pending",
        "totalAmount": 18500.0,
        "createdAt": "2026-04-22",
    },
    {
        "orderId": 1002,
        "retailerId": 2,
        "retailerName": "Acme Retail",
        "orderStatus": "Processing",
        "totalAmount": 24120.0,
        "createdAt": "2026-04-21",
    },
    {
        "orderId": 1003,
        "retailerId": 3,
        "retailerName": "Urban Bazaar",
        "orderStatus": "Delivered",
        "totalAmount": 15780.0,
        "createdAt": "2026-04-19",
    },
    {
        "orderId": 1004,
        "retailerId": 1,
        "retailerName": "Northwind Traders",
        "orderStatus": "Pending",
        "totalAmount": 9100.0,
        "createdAt": "2026-04-18",
    },
]

SAMPLE_INVENTORY = [
    {
        "itemId": 201,
        "itemName": "Cold Chain Sensor",
        "quantity": 18,
        "warehouse": "Warehouse A",
        "lowStockThreshold": 20,
    },
    {
        "itemId": 202,
        "itemName": "Packaging Film",
        "quantity": 145,
        "warehouse": "Warehouse B",
        "lowStockThreshold": 40,
    },
    {
        "itemId": 203,
        "itemName": "Delivery Crates",
        "quantity": 11,
        "warehouse": "Warehouse A",
        "lowStockThreshold": 15,
    },
    {
        "itemId": 204,
        "itemName": "Forklift Battery",
        "quantity": 9,
        "warehouse": "Warehouse C",
        "lowStockThreshold": 10,
    },
]

SAMPLE_SHIPMENTS = [
    {
        "shipmentId": 301,
        "source": "Warehouse A",
        "destination": "Northwind Traders",
        "shipmentStatus": "In Transit",
    },
    {
        "shipmentId": 302,
        "source": "Warehouse B",
        "destination": "Acme Retail",
        "shipmentStatus": "Delivered",
    },
    {
        "shipmentId": 303,
        "source": "Warehouse C",
        "destination": "Urban Bazaar",
        "shipmentStatus": "In Transit",
    },
]

SAMPLE_PAYMENTS = [
    {"paymentId": 401, "orderId": 1001, "amount": 18500.0, "status": "Pending"},
    {"paymentId": 402, "orderId": 1002, "amount": 24120.0, "status": "Paid"},
    {"paymentId": 403, "orderId": 1003, "amount": 15780.0, "status": "Paid"},
]


def _copy(data):
    return deepcopy(data)


def summary_from_sample():
    total_orders = len(SAMPLE_ORDERS)
    pending_orders = sum(1 for order in SAMPLE_ORDERS if order["orderStatus"] == "Pending")
    total_revenue = sum(order["totalAmount"] for order in SAMPLE_ORDERS)
    low_inventory_alerts = sum(
        1 for item in SAMPLE_INVENTORY if item["quantity"] < item["lowStockThreshold"]
    )
    in_transit_shipments = sum(1 for shipment in SAMPLE_SHIPMENTS if shipment["shipmentStatus"] == "In Transit")

    return {
        "totalOrders": total_orders,
        "pendingOrders": pending_orders,
        "totalRevenue": round(total_revenue, 2),
        "lowInventoryAlerts": low_inventory_alerts,
        "inTransitShipments": in_transit_shipments,
    }


def dashboard_from_sample():
    low_stock_items = [
        {
            **item,
            "isLowStock": item["quantity"] < item["lowStockThreshold"],
        }
        for item in SAMPLE_INVENTORY
        if item["quantity"] < item["lowStockThreshold"]
    ]

    return {
        "summary": summary_from_sample(),
        "recentOrders": _copy(SAMPLE_ORDERS[:4]),
        "lowStockItems": low_stock_items,
    }


def orders_from_sample():
    return _copy(SAMPLE_ORDERS)


def order_detail_from_sample(order_id):
    for order in SAMPLE_ORDERS:
        if order["orderId"] == order_id:
            return {
                "order": _copy(order),
                "relatedShipment": next(
                    (
                        _copy(shipment)
                        for shipment in SAMPLE_SHIPMENTS
                        if shipment["destination"] == order["retailerName"]
                    ),
                    None,
                ),
                "relatedPayment": next(
                    (
                        _copy(payment)
                        for payment in SAMPLE_PAYMENTS
                        if payment["orderId"] == order_id
                    ),
                    None,
                ),
            }
    return None


def inventory_from_sample():
    return [
        {
            **item,
            "isLowStock": item["quantity"] < item["lowStockThreshold"],
        }
        for item in SAMPLE_INVENTORY
    ]


def shipments_from_sample():
    return _copy(SAMPLE_SHIPMENTS)


def payments_from_sample():
    return _copy(SAMPLE_PAYMENTS)


def retailers_from_sample():
    return _copy(SAMPLE_RETAILERS)
