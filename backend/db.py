import os
from datetime import date, datetime
from decimal import Decimal

import mysql.connector
from dotenv import load_dotenv

from sample_data import (
    dashboard_from_sample,
    create_order as create_order_from_sample,
    create_retailer as create_retailer_from_sample,
    inventory_from_sample,
    order_detail_from_sample,
    orders_from_sample,
    payments_from_sample,
    retailers_from_sample,
    shipments_from_sample,
    summary_from_sample,
)


load_dotenv()


def mysql_configured():
    return all(
        [
            os.getenv("MYSQL_HOST"),
            os.getenv("MYSQL_USER"),
            os.getenv("MYSQL_PASSWORD"),
            os.getenv("MYSQL_DATABASE"),
        ]
    )


def connection_params():
    return {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "supplychaindb"),
        "autocommit": True,
    }


def get_connection():
    if not mysql_configured():
        raise RuntimeError("MySQL environment variables are not configured.")
    return mysql.connector.connect(**connection_params())


def normalize_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def normalize_row(row):
    return {key: normalize_value(value) for key, value in row.items()}


def fetch_all(query, params=None):
    connection = get_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())
        return [normalize_row(row) for row in cursor.fetchall()]
    finally:
        connection.close()


def fetch_one(query, params=None):
    connection = get_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())
        row = cursor.fetchone()
        return normalize_row(row) if row else None
    finally:
        connection.close()


def execute_write(query, params=None):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(query, params or ())
        connection.commit()
        return cursor.lastrowid
    finally:
        connection.close()


def get_dashboard_data():
    if not mysql_configured():
        payload = dashboard_from_sample()
        payload["summary"]["source"] = "sample"
        return payload

    summary_row = fetch_one(
        """
        SELECT
            COUNT(*) AS totalOrders,
            SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS pendingOrders,
            COALESCE(SUM(TotalAmount), 0) AS totalRevenue
        FROM orders
        """
    ) or {"totalOrders": 0, "pendingOrders": 0, "totalRevenue": 0}

    low_inventory_row = fetch_one(
        """
        SELECT COUNT(*) AS lowInventoryAlerts
        FROM inventoryitem
        WHERE Quantity < 100
        """
    ) or {"lowInventoryAlerts": 0}

    in_transit_row = fetch_one(
        """
        SELECT COUNT(*) AS inTransitShipments
        FROM shipment
        WHERE Status = 'In Transit'
        """
    ) or {"inTransitShipments": 0}

    recent_orders = fetch_all(
        """
        SELECT
            o.OrderID AS orderId,
            o.RetailerID AS retailerId,
            r.Name AS retailerName,
            o.Status AS orderStatus,
            o.TotalAmount AS totalAmount,
            o.OrderDate AS createdAt
        FROM orders o
        LEFT JOIN retailer r ON r.RetailerID = o.RetailerID
        ORDER BY o.OrderDate DESC, o.OrderID DESC
        LIMIT 5
        """
    )

    low_stock_items = fetch_all(
        """
        SELECT
            i.ItemID AS itemId,
            i.BatchID AS batchId,
            i.WarehouseID AS warehouseId,
            i.Quantity AS quantity,
            w.Location AS warehouse,
            CASE WHEN i.Quantity < 100 THEN TRUE ELSE FALSE END AS isLowStock
        FROM inventoryitem i
        LEFT JOIN warehouse w ON w.WarehouseID = i.WarehouseID
        WHERE i.Quantity < 100
        ORDER BY i.ItemID DESC
        """
    )

    return {
        "summary": {
            "totalOrders": int(summary_row["totalOrders"] or 0),
            "pendingOrders": int(summary_row["pendingOrders"] or 0),
            "totalRevenue": float(summary_row["totalRevenue"] or 0),
            "lowInventoryAlerts": int(low_inventory_row["lowInventoryAlerts"] or 0),
            "inTransitShipments": int(in_transit_row["inTransitShipments"] or 0),
            "source": "mysql",
        },
        "recentOrders": recent_orders,
        "lowStockItems": low_stock_items,
    }


def get_orders(search=None, status=None):
    if not mysql_configured():
        rows = orders_from_sample()
        if search:
            search_value = search.lower()
            rows = [
                row
                for row in rows
                if search_value in str(row["orderId"]).lower()
                or search_value in row["retailerName"].lower()
                or search_value in row["orderStatus"].lower()
            ]
        if status:
            rows = [row for row in rows if row["orderStatus"].lower() == status.lower()]
        return rows

    query = """
        SELECT
            o.OrderID AS orderId,
            o.RetailerID AS retailerId,
            r.Name AS retailerName,
            o.Status AS orderStatus,
            o.TotalAmount AS totalAmount,
            o.OrderDate AS createdAt
        FROM orders o
        LEFT JOIN retailer r ON r.RetailerID = o.RetailerID
        WHERE (%s IS NULL OR CAST(o.OrderID AS CHAR) LIKE CONCAT('%%', %s, '%%')
               OR COALESCE(r.Name, '') LIKE CONCAT('%%', %s, '%%')
               OR o.Status LIKE CONCAT('%%', %s, '%%'))
          AND (%s IS NULL OR o.Status = %s)
        ORDER BY o.OrderDate DESC, o.OrderID DESC
    """
    return fetch_all(
        query,
        (
            search,
            search,
            search,
            search,
            status,
            status,
        ),
    )


def get_order_detail(order_id):
    if not mysql_configured():
        return order_detail_from_sample(order_id)

    order = fetch_one(
        """
        SELECT
            o.OrderID AS orderId,
            o.RetailerID AS retailerId,
            r.Name AS retailerName,
            r.Location AS retailerLocation,
            o.Status AS orderStatus,
            o.TotalAmount AS totalAmount,
            o.OrderDate AS createdAt
        FROM orders o
        LEFT JOIN retailer r ON r.RetailerID = o.RetailerID
        WHERE o.OrderID = %s
        """,
        (order_id,),
    )
    if not order:
        return None

    related_invoice = fetch_one(
        """
        SELECT
            InvoiceID AS invoiceId,
            OrderID AS orderId,
            Amount AS amount,
            IssueDate AS issueDate
        FROM invoice
        WHERE OrderID = %s
        ORDER BY InvoiceID DESC
        LIMIT 1
        """,
        (order_id,),
    )

    related_payment = fetch_one(
        """
        SELECT
            p.PaymentID AS paymentId,
            i.OrderID AS orderId,
            p.Amount AS amount,
            p.Status AS status,
            p.PaymentDate AS paidAt,
            p.InvoiceID AS invoiceId
        FROM payment p
        LEFT JOIN invoice i ON i.InvoiceID = p.InvoiceID
        WHERE i.OrderID = %s
        LIMIT 1
        """,
        (order_id,),
    )

    related_shipment = fetch_one(
        """
        SELECT
            s.ShipmentID AS shipmentId,
            r.Source AS source,
            r.Destination AS destination,
            s.Status AS shipmentStatus,
            s.VehicleID AS vehicleId,
            s.RouteID AS routeId,
            s.ShipmentDate AS shipmentDate
        FROM shipment s
        LEFT JOIN route r ON r.RouteID = s.RouteID
        LEFT JOIN orders o ON o.OrderID = %s
        LEFT JOIN retailer re ON re.RetailerID = o.RetailerID
        WHERE r.Destination = COALESCE(re.Location, re.Name)
           OR s.ShipmentID = %s
        ORDER BY CASE WHEN r.Destination = COALESCE(re.Location, re.Name) THEN 0 ELSE 1 END,
                 s.ShipmentDate DESC,
                 s.ShipmentID DESC
        LIMIT 1
        """,
        (order_id, order_id),
    )

    return {
        "order": order,
        "relatedInvoice": related_invoice,
        "relatedPayment": related_payment,
        "relatedShipment": related_shipment,
    }


def get_inventory():
    if not mysql_configured():
        return inventory_from_sample()

    return fetch_all(
        """
        SELECT
            i.ItemID AS itemId,
            i.BatchID AS batchId,
            b.MaterialID AS materialId,
            b.ManufactureDate AS manufactureDate,
            b.ExpiryDate AS expiryDate,
            b.Quantity AS batchQuantity,
            rm.Type AS materialType,
            rm.QualityGrade AS qualityGrade,
            rm.UnitCost AS unitCost,
            s.SupplierID AS supplierId,
            s.Name AS supplierName,
            i.WarehouseID AS warehouseId,
            i.Quantity AS quantity,
            w.Location AS warehouse,
            CASE WHEN i.Quantity < 100 THEN TRUE ELSE FALSE END AS isLowStock
        FROM inventoryitem i
        LEFT JOIN batch b ON b.BatchID = i.BatchID
        LEFT JOIN rawmaterial rm ON rm.MaterialID = b.MaterialID
        LEFT JOIN supplier s ON s.SupplierID = rm.SupplierID
        LEFT JOIN warehouse w ON w.WarehouseID = i.WarehouseID
        ORDER BY i.ItemID DESC
        """
    )


def get_shipments():
    if not mysql_configured():
        return shipments_from_sample()

    return fetch_all(
        """
        SELECT
            s.ShipmentID AS shipmentId,
            r.Source AS source,
            r.Destination AS destination,
            s.Status AS shipmentStatus,
            s.VehicleID AS vehicleId,
            s.RouteID AS routeId,
            s.ShipmentDate AS shipmentDate
        FROM shipment s
        LEFT JOIN route r ON r.RouteID = s.RouteID
        ORDER BY s.ShipmentDate DESC, s.ShipmentID DESC
        """
    )


def get_payments():
    if not mysql_configured():
        return payments_from_sample()

    return fetch_all(
        """
        SELECT
            p.PaymentID AS paymentId,
            i.OrderID AS orderId,
            p.Amount AS amount,
            p.Status AS status,
            p.PaymentDate AS paidAt,
            p.InvoiceID AS invoiceId
        FROM payment p
        LEFT JOIN invoice i ON i.InvoiceID = p.InvoiceID
        ORDER BY p.PaymentID DESC
        """
    )


def get_retailers():
    if not mysql_configured():
        return retailers_from_sample()

    return fetch_all(
        """
        SELECT
            RetailerID AS retailerId,
            Name AS retailerName,
            Contact AS contact,
            Location AS location
        FROM retailer
        ORDER BY Name ASC
        """
    )


def create_retailer(retailer_name, contact=None, location=None):
    if not mysql_configured():
        return create_retailer_from_sample(retailer_name, contact=contact, location=location)

    next_id_row = fetch_one(
        """
        SELECT COALESCE(MAX(RetailerID), 0) + 1 AS nextRetailerId
        FROM retailer
        """
    ) or {"nextRetailerId": 1}

    retailer_id = int(next_id_row["nextRetailerId"])
    execute_write(
        """
        INSERT INTO retailer (RetailerID, Name, Contact, Location)
        VALUES (%s, %s, %s, %s)
        """,
        (retailer_id, retailer_name, contact, location),
    )
    return fetch_one(
        """
        SELECT
            RetailerID AS retailerId,
            Name AS retailerName,
            Contact AS contact,
            Location AS location
        FROM retailer
        WHERE RetailerID = %s
        """,
        (retailer_id,),
    )


def get_status_payload():
    source = "mysql" if mysql_configured() else "sample"
    summary = get_dashboard_data()["summary"]
    summary.setdefault("source", source)
    return {
        "connected": mysql_configured(),
        "source": source,
        "summary": summary if summary else summary_from_sample(),
    }


TABLE_OVERVIEW_TABLES = [
    "batch",
    "damagereport",
    "inventoryitem",
    "invoice",
    "orders",
    "payment",
    "product_2nf",
    "rawmaterial",
    "retailer",
    "returns",
    "route",
    "shipment",
    "supplier",
    "user",
    "vehicle",
    "warehouse",
]


def get_table_overview():
    if not mysql_configured():
        return {
            "connected": False,
            "source": "sample",
            "tables": [],
        }

    tables = []
    for table_name in TABLE_OVERVIEW_TABLES:
        row = fetch_one(f"SELECT COUNT(*) AS rowCount FROM `{table_name}`") or {"rowCount": 0}
        sample_rows = fetch_all(f"SELECT * FROM `{table_name}` ORDER BY 1 DESC LIMIT 3")
        tables.append(
            {
                "name": table_name,
                "rowCount": int(row["rowCount"] or 0),
                "sampleRows": sample_rows,
            }
        )

    return {
        "connected": True,
        "source": "mysql",
        "tables": tables,
    }


def create_order(retailer_id, total_amount, order_status="Pending", inventory_item_id=None, inventory_quantity=1):
    if not mysql_configured():
        return create_order_from_sample(
            retailer_id,
            total_amount,
            order_status=order_status,
            inventory_item_id=inventory_item_id,
            inventory_quantity=inventory_quantity,
        )

    next_id_row = fetch_one(
        """
        SELECT COALESCE(MAX(OrderID), 0) + 1 AS nextOrderId
        FROM orders
        """
    ) or {"nextOrderId": 1}

    order_id = int(next_id_row["nextOrderId"])
    execute_write(
        """
        INSERT INTO orders (OrderID, RetailerID, OrderDate, Status, TotalAmount)
        VALUES (%s, %s, CURDATE(), %s, %s)
        """,
        (order_id, retailer_id, order_status, total_amount),
    )

    if inventory_item_id is not None:
        inventory_row = fetch_one(
            "SELECT ItemID AS itemId, Quantity AS quantity FROM inventoryitem WHERE ItemID = %s",
            (inventory_item_id,),
        )
        if not inventory_row:
            raise RuntimeError(f"Inventory item {inventory_item_id} was not found.")

        requested_quantity = int(inventory_quantity or 1)
        if requested_quantity <= 0:
            raise RuntimeError("Inventory quantity must be greater than zero.")

        current_quantity = int(inventory_row["quantity"] or 0)
        if requested_quantity > current_quantity:
            raise RuntimeError(
                f"Inventory item {inventory_item_id} only has {current_quantity} units available."
            )

        execute_write(
            "UPDATE inventoryitem SET Quantity = Quantity - %s WHERE ItemID = %s",
            (requested_quantity, inventory_item_id),
        )

    # Create an invoice for the order and link a payment
    invoice_row = fetch_one(
        "SELECT COALESCE(MAX(InvoiceID), 0) + 1 AS nextInvoiceId FROM invoice"
    ) or {"nextInvoiceId": 1}
    invoice_id = int(invoice_row["nextInvoiceId"])
    execute_write(
        "INSERT INTO invoice (InvoiceID, OrderID, Amount, IssueDate) VALUES (%s, %s, %s, CURDATE())",
        (invoice_id, order_id, total_amount),
    )

    payment_row = fetch_one(
        "SELECT COALESCE(MAX(PaymentID), 0) + 1 AS nextPaymentId FROM payment"
    ) or {"nextPaymentId": 1}
    payment_id = int(payment_row["nextPaymentId"])
    execute_write(
        "INSERT INTO payment (PaymentID, InvoiceID, PaymentDate, Amount, Status) VALUES (%s, %s, CURDATE(), %s, %s)",
        (payment_id, invoice_id, total_amount, "Paid"),
    )

    # Attempt to create/assign a route and shipment that links to the retailer location
    retailer_row = fetch_one("SELECT Location AS location FROM retailer WHERE RetailerID = %s", (retailer_id,))
    retailer_location = retailer_row.get("location") if retailer_row else None
    route_id = None
    if retailer_location:
        existing_route = fetch_one(
            "SELECT RouteID AS routeId FROM route WHERE Destination = %s LIMIT 1",
            (retailer_location,),
        )
        if existing_route:
            route_id = int(existing_route["routeId"])
        else:
            next_route = fetch_one("SELECT COALESCE(MAX(RouteID), 0) + 1 AS nextRouteId FROM route") or {"nextRouteId": 1}
            route_id = int(next_route["nextRouteId"])
            # Use empty source for generated routes; front-end can edit the shipment route later
            execute_write("INSERT INTO route (RouteID, Source, Destination, Distance) VALUES (%s, %s, %s, %s)", (route_id, "", retailer_location, 0))

    # Find a vehicle to assign
    vehicle = fetch_one("SELECT VehicleID AS vehicleId FROM vehicle ORDER BY VehicleID ASC LIMIT 1")
    if vehicle and route_id is not None:
        next_shipment = fetch_one("SELECT COALESCE(MAX(ShipmentID), 0) + 1 AS nextShipmentId FROM shipment") or {"nextShipmentId": 1}
        shipment_id = int(next_shipment["nextShipmentId"])
        execute_write(
            "INSERT INTO shipment (ShipmentID, VehicleID, RouteID, ShipmentDate, Status) VALUES (%s, %s, %s, CURDATE(), %s)",
            (shipment_id, int(vehicle["vehicleId"]), route_id, "Created"),
        )

    return get_order_detail(order_id)["order"]


def update_order(order_id, retailer_id=None, order_status=None, total_amount=None):
    if not mysql_configured():
        current = get_order_detail(order_id)
        if not current:
            return None
        updated = current["order"].copy()
        if retailer_id is not None:
            updated["retailerId"] = retailer_id
        if order_status is not None:
            updated["orderStatus"] = order_status
        if total_amount is not None:
            updated["totalAmount"] = float(total_amount)
        return updated

    assignments = []
    values = []
    if retailer_id is not None:
        assignments.append("RetailerID = %s")
        values.append(retailer_id)
    if order_status is not None:
        assignments.append("Status = %s")
        values.append(order_status)
    if total_amount is not None:
        assignments.append("TotalAmount = %s")
        values.append(total_amount)

    if not assignments:
        return get_order_detail(order_id)["order"]

    values.append(order_id)
    execute_write(
        f"UPDATE orders SET {', '.join(assignments)} WHERE OrderID = %s",
        tuple(values),
    )
    detail = get_order_detail(order_id)
    return detail["order"] if detail else None


def delete_order(order_id):
    if not mysql_configured():
        return True

    execute_write("DELETE FROM orders WHERE OrderID = %s", (order_id,))
    return True


def update_inventory(item_id, quantity=None, warehouse=None, low_stock_threshold=None):
    if not mysql_configured():
        rows = inventory_from_sample()
        for row in rows:
            if row["itemId"] == item_id:
                if quantity is not None:
                    row["quantity"] = int(quantity)
                if warehouse is not None:
                    row["warehouse"] = warehouse
                row["isLowStock"] = row["quantity"] < 100
                return row
        return None

    if quantity is None:
        return fetch_one(
            """
            SELECT
                i.ItemID AS itemId,
                i.BatchID AS batchId,
                b.MaterialID AS materialId,
                b.ManufactureDate AS manufactureDate,
                b.ExpiryDate AS expiryDate,
                b.Quantity AS batchQuantity,
                rm.Type AS materialType,
                rm.QualityGrade AS qualityGrade,
                rm.UnitCost AS unitCost,
                s.SupplierID AS supplierId,
                s.Name AS supplierName,
                i.WarehouseID AS warehouseId,
                i.Quantity AS quantity,
                w.Location AS warehouse,
                CASE WHEN i.Quantity < 100 THEN TRUE ELSE FALSE END AS isLowStock
            FROM inventoryitem i
            LEFT JOIN batch b ON b.BatchID = i.BatchID
            LEFT JOIN rawmaterial rm ON rm.MaterialID = b.MaterialID
            LEFT JOIN supplier s ON s.SupplierID = rm.SupplierID
            LEFT JOIN warehouse w ON w.WarehouseID = i.WarehouseID
            WHERE i.ItemID = %s
            """,
            (item_id,),
        )

    updates = ["Quantity = %s"]
    values = [quantity]

    if warehouse is not None:
        warehouse_row = fetch_one("SELECT WarehouseID AS warehouseId FROM warehouse WHERE Location = %s LIMIT 1", (warehouse,))
        if not warehouse_row:
            raise RuntimeError(f"Warehouse location '{warehouse}' was not found.")
        updates.append("WarehouseID = %s")
        values.append(int(warehouse_row["warehouseId"]))

    values.append(item_id)
    execute_write(f"UPDATE inventoryitem SET {', '.join(updates)} WHERE ItemID = %s", tuple(values))
    return fetch_one(
        """
        SELECT
            i.ItemID AS itemId,
            i.BatchID AS batchId,
            b.MaterialID AS materialId,
            b.ManufactureDate AS manufactureDate,
            b.ExpiryDate AS expiryDate,
            b.Quantity AS batchQuantity,
            rm.Type AS materialType,
            rm.QualityGrade AS qualityGrade,
            rm.UnitCost AS unitCost,
            s.SupplierID AS supplierId,
            s.Name AS supplierName,
            i.WarehouseID AS warehouseId,
            i.Quantity AS quantity,
            w.Location AS warehouse,
            CASE WHEN i.Quantity < 100 THEN TRUE ELSE FALSE END AS isLowStock
        FROM inventoryitem i
        LEFT JOIN batch b ON b.BatchID = i.BatchID
        LEFT JOIN rawmaterial rm ON rm.MaterialID = b.MaterialID
        LEFT JOIN supplier s ON s.SupplierID = rm.SupplierID
        LEFT JOIN warehouse w ON w.WarehouseID = i.WarehouseID
        WHERE i.ItemID = %s
        """,
        (item_id,),
    )


def delete_inventory(item_id):
    if not mysql_configured():
        return True

    execute_write("DELETE FROM inventoryitem WHERE ItemID = %s", (item_id,))
    return True


def create_shipment(source, destination, shipment_status="In Transit"):
    if not mysql_configured():
        return {
            "shipmentId": 9999,
            "source": source,
            "destination": destination,
            "shipmentStatus": shipment_status,
        }

    route = fetch_one(
        "SELECT RouteID AS routeId FROM route WHERE Source = %s AND Destination = %s LIMIT 1",
        (source, destination),
    )
    if route:
        route_id = route["routeId"]
    else:
        next_route_row = fetch_one(
            """
            SELECT COALESCE(MAX(RouteID), 0) + 1 AS nextRouteId
            FROM route
            """
        ) or {"nextRouteId": 1}
        route_id = int(next_route_row["nextRouteId"])
        execute_write(
            "INSERT INTO route (RouteID, Source, Destination, Distance) VALUES (%s, %s, %s, %s)",
            (route_id, source, destination, 0),
        )

    vehicle = fetch_one("SELECT VehicleID AS vehicleId FROM vehicle ORDER BY VehicleID ASC LIMIT 1")
    if not vehicle:
        raise RuntimeError("No vehicle records found.")

    next_shipment_row = fetch_one(
        """
        SELECT COALESCE(MAX(ShipmentID), 0) + 1 AS nextShipmentId
        FROM shipment
        """
    ) or {"nextShipmentId": 1}
    shipment_id = int(next_shipment_row["nextShipmentId"])

    execute_write(
        """
        INSERT INTO shipment (ShipmentID, VehicleID, RouteID, ShipmentDate, Status)
        VALUES (%s, %s, %s, CURDATE(), %s)
        """,
        (shipment_id, vehicle["vehicleId"], route_id, shipment_status),
    )
    return fetch_one(
        """
        SELECT
            s.ShipmentID AS shipmentId,
            r.Source AS source,
            r.Destination AS destination,
            s.Status AS shipmentStatus,
            s.VehicleID AS vehicleId,
            s.RouteID AS routeId,
            s.ShipmentDate AS shipmentDate
        FROM shipment s
        LEFT JOIN route r ON r.RouteID = s.RouteID
        WHERE s.ShipmentID = %s
        """,
        (shipment_id,),
    )


def update_shipment(shipment_id, source=None, destination=None, shipment_status=None):
    if not mysql_configured():
        rows = shipments_from_sample()
        for row in rows:
            if row["shipmentId"] == shipment_id:
                if source is not None:
                    row["source"] = source
                if destination is not None:
                    row["destination"] = destination
                if shipment_status is not None:
                    row["shipmentStatus"] = shipment_status
                return row
        return None

    if shipment_status is not None:
        execute_write("UPDATE shipment SET Status = %s WHERE ShipmentID = %s", (shipment_status, shipment_id))

    if source is not None or destination is not None:
        shipment_row = fetch_one("SELECT RouteID AS routeId FROM shipment WHERE ShipmentID = %s", (shipment_id,))
        if shipment_row:
            route_id = shipment_row["routeId"]
            route_assignments = []
            route_values = []
            if source is not None:
                route_assignments.append("Source = %s")
                route_values.append(source)
            if destination is not None:
                route_assignments.append("Destination = %s")
                route_values.append(destination)
            if route_assignments:
                route_values.append(route_id)
                execute_write(f"UPDATE route SET {', '.join(route_assignments)} WHERE RouteID = %s", tuple(route_values))

    return fetch_one(
        """
        SELECT
            s.ShipmentID AS shipmentId,
            r.Source AS source,
            r.Destination AS destination,
            s.Status AS shipmentStatus,
            s.VehicleID AS vehicleId,
            s.RouteID AS routeId,
            s.ShipmentDate AS shipmentDate
        FROM shipment s
        LEFT JOIN route r ON r.RouteID = s.RouteID
        WHERE s.ShipmentID = %s
        """,
        (shipment_id,),
    )


def delete_shipment(shipment_id):
    if not mysql_configured():
        return True

    execute_write("DELETE FROM shipment WHERE ShipmentID = %s", (shipment_id,))
    return True


def create_payment(order_id, amount, status="Paid"):
    if not mysql_configured():
        return {"paymentId": 9999, "orderId": order_id, "amount": float(amount), "status": status}

    existing_invoice = fetch_one(
        "SELECT InvoiceID AS invoiceId FROM invoice WHERE OrderID = %s ORDER BY InvoiceID DESC LIMIT 1",
        (order_id,),
    )
    if existing_invoice:
        invoice_id = int(existing_invoice["invoiceId"])
    else:
        next_invoice_row = fetch_one(
            "SELECT COALESCE(MAX(InvoiceID), 0) + 1 AS nextInvoiceId FROM invoice"
        ) or {"nextInvoiceId": 1}
        invoice_id = int(next_invoice_row["nextInvoiceId"])
        execute_write(
            """
            INSERT INTO invoice (InvoiceID, OrderID, Amount, IssueDate)
            VALUES (%s, %s, %s, CURDATE())
            """,
            (invoice_id, order_id, amount),
        )

    next_payment_row = fetch_one(
        "SELECT COALESCE(MAX(PaymentID), 0) + 1 AS nextPaymentId FROM payment"
    ) or {"nextPaymentId": 1}
    payment_id = int(next_payment_row["nextPaymentId"])
    execute_write(
        """
        INSERT INTO payment (PaymentID, InvoiceID, PaymentDate, Amount, Status)
        VALUES (%s, %s, CURDATE(), %s, %s)
        """,
        (payment_id, invoice_id, amount, status),
    )
    return fetch_one(
        """
        SELECT
            p.PaymentID AS paymentId,
            i.OrderID AS orderId,
            p.Amount AS amount,
            p.Status AS status,
            p.PaymentDate AS paidAt,
            p.InvoiceID AS invoiceId
        FROM payment p
        LEFT JOIN invoice i ON i.InvoiceID = p.InvoiceID
        WHERE p.PaymentID = %s
        """,
        (payment_id,),
    )


def update_payment(payment_id, amount=None, status=None):
    if not mysql_configured():
        rows = payments_from_sample()
        for row in rows:
            if row["paymentId"] == payment_id:
                if amount is not None:
                    row["amount"] = float(amount)
                if status is not None:
                    row["status"] = status
                return row
        return None

    payment = fetch_one(
        "SELECT PaymentID AS paymentId, InvoiceID AS invoiceId, Amount AS amount, Status AS status FROM payment WHERE PaymentID = %s",
        (payment_id,),
    )
    if not payment:
        return None

    if amount is not None:
        execute_write("UPDATE payment SET Amount = %s WHERE PaymentID = %s", (amount, payment_id))
        if payment.get("invoiceId"):
            execute_write("UPDATE invoice SET Amount = %s WHERE InvoiceID = %s", (amount, payment["invoiceId"]))

    if status is not None:
        execute_write("UPDATE payment SET Status = %s WHERE PaymentID = %s", (status, payment_id))

    return fetch_one(
        """
        SELECT
            p.PaymentID AS paymentId,
            i.OrderID AS orderId,
            p.Amount AS amount,
            p.Status AS status,
            p.PaymentDate AS paidAt,
            p.InvoiceID AS invoiceId
        FROM payment p
        LEFT JOIN invoice i ON i.InvoiceID = p.InvoiceID
        WHERE p.PaymentID = %s
        """,
        (payment_id,),
    )


def delete_payment(payment_id):
    if not mysql_configured():
        return True

    execute_write("DELETE FROM payment WHERE PaymentID = %s", (payment_id,))
    return True
