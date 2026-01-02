import { useRef, useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, X } from "lucide-react";
import type { Order, Client, Product } from "@shared/schema";
import logoImage from "@assets/image_1767220512226.png";

interface OrderReceiptProps {
  order: Order;
  client?: Client;
  onClose?: () => void;
}

const companyInfo = {
  name: "Liquid Washes Laundry",
  address: "Centra Market D/109, Al Dhanna City, Al Ruwais",
  city: "Abu Dhabi, UAE",
  phone: "+971 50 123 4567",
};

export function OrderReceipt({ order, client, onClose }: OrderReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [logoBase64, setLogoBase64] = useState<string>("");

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL("image/png"));
      }
    };
    img.src = logoImage;
  }, []);

  const parsedItems = useMemo(() => {
    if (!order.items) return [];
    const itemParts = order.items.split(",").map(s => s.trim());
    return itemParts.map(part => {
      const match = part.match(/^(\d+)x\s+(.+)$/i);
      if (match) {
        const qty = parseInt(match[1]);
        const name = match[2].trim();
        const product = products?.find(p => p.name.toLowerCase() === name.toLowerCase());
        const price = product ? parseFloat(product.price || "0") : 0;
        return { name, qty, price, total: qty * price };
      }
      return { name: part, qty: 1, price: 0, total: 0 };
    });
  }, [order.items, products]);

  const handlePrint = () => {
    if (receiptRef.current) {
      const printContent = receiptRef.current.innerHTML;
      const printWindow = window.open("", "_blank", "width=800,height=600");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Order Receipt ${order.orderNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                background: white; 
                color: #333;
              }
              .receipt-container { max-width: 600px; margin: 0 auto; }
              .header { display: flex; align-items: flex-start; gap: 15px; margin-bottom: 30px; border-bottom: 2px solid #1e40af; padding-bottom: 20px; }
              .logo { width: 70px; height: 70px; flex-shrink: 0; }
              .logo img { width: 100%; height: 100%; object-fit: contain; }
              .company-info { flex: 1; }
              .company-name { font-size: 22px; font-weight: bold; color: #1e40af; margin-bottom: 6px; }
              .company-address { font-size: 11px; color: #666; line-height: 1.5; }
              .receipt-title { font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0; color: #1e40af; }
              .info-row { display: flex; justify-content: space-between; margin-bottom: 15px; }
              .info-section { width: 48%; }
              .info-label { font-size: 12px; color: #666; margin-bottom: 4px; }
              .info-value { font-size: 14px; font-weight: 500; }
              .order-number { font-size: 18px; font-weight: bold; color: #1e40af; text-align: center; margin: 20px 0; padding: 10px; background: #f3f4f6; border-radius: 8px; }
              .items-section { margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
              .items-title { font-weight: 600; margin-bottom: 10px; }
              .items-list { white-space: pre-wrap; font-size: 14px; }
              .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #333; }
              .items-table th, .items-table td { padding: 6px 8px; text-align: left; border: 1px solid #333; }
              .items-table th { background: #1e40af; font-weight: 600; font-size: 11px; color: white; text-transform: uppercase; }
              .items-table td { font-size: 12px; }
              .items-table tr:nth-child(even) { background: #f9fafb; }
              .items-table .qty-col { text-align: center; width: 50px; }
              .items-table .price-col { text-align: right; width: 70px; }
              .items-table .total-col { text-align: right; width: 80px; font-weight: 600; }
              .status-section { margin: 20px 0; }
              .status-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
              .status-label { font-weight: 500; }
              .status-value { color: #666; }
              .status-done { color: #16a34a; font-weight: 600; }
              .status-pending { color: #dc2626; }
              .totals { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e5e5; }
              .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
              .total-row.grand-total { font-size: 18px; font-weight: bold; color: #1e40af; border-top: 2px solid #1e40af; margin-top: 10px; padding-top: 15px; }
              .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid #e5e5e5; }
              .footer p { font-size: 12px; color: #666; }
              .delivery-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
              .delivery-type { background: #3b82f6; color: white; }
              .urgent-badge { background: #dc2626; color: white; margin-left: 8px; }
              @media print { body { padding: 0; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  const getStatusText = (done: boolean | null) => done ? "Completed" : "Pending";
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalAmount = parseFloat(order.totalAmount || "0");
  const discountPercent = parseFloat(order.discountPercent || "0");
  const discountAmount = parseFloat(order.discountAmount || "0");
  const finalAmount = parseFloat(order.finalAmount || "0") || (totalAmount - discountAmount);
  const paidAmount = parseFloat(order.paidAmount || "0");
  const balance = finalAmount - paidAmount;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-white">
        <div className="flex items-center justify-between p-4 border-b bg-primary/5">
          <h2 className="text-lg font-semibold text-foreground">Order Receipt</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-order-receipt">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            {onClose && (
              <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-order-receipt">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div ref={receiptRef} className="p-6 receipt-container">
          <div className="header">
            <div className="logo">
              <img src={logoBase64 || logoImage} alt="Company Logo" />
            </div>
            <div className="company-info">
              <div className="company-name">{companyInfo.name}</div>
              <div className="company-address">
                {companyInfo.address}<br />
                {companyInfo.city}<br />
                {companyInfo.phone}
              </div>
            </div>
          </div>

          <div className="receipt-title">ORDER RECEIPT</div>

          <div className="order-number">
            Order # {order.orderNumber}
            <div style={{ marginTop: "8px" }}>
              <span className="delivery-badge delivery-type">
                {order.deliveryType === "delivery" ? "Delivery" : "Take Away"}
              </span>
              {order.urgent && <span className="delivery-badge urgent-badge">URGENT</span>}
            </div>
          </div>

          <div className="info-row">
            <div className="info-section">
              <div className="info-label">Entry Date</div>
              <div className="info-value">{formatDate(order.entryDate)}</div>
            </div>
            <div className="info-section" style={{ textAlign: "right" }}>
              <div className="info-label">Expected Delivery</div>
              <div className="info-value">{formatDate(order.expectedDeliveryAt)}</div>
            </div>
          </div>

          {client && (
            <div className="info-row">
              <div className="info-section">
                <div className="info-label">Customer</div>
                <div className="info-value">{client.name}</div>
                {client.phone && <div className="info-value" style={{ fontSize: "12px", color: "#666" }}>{client.phone}</div>}
                {client.address && <div className="info-value" style={{ fontSize: "12px", color: "#666" }}>{client.address}</div>}
              </div>
            </div>
          )}

          {parsedItems.length > 0 && (
            <div className="items-section">
              <div className="items-title">Items / Services</div>
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: "30px", textAlign: "center" }}>#</th>
                    <th>Item</th>
                    <th className="qty-col">Qty</th>
                    <th className="price-col">Price</th>
                    <th className="total-col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td>{item.name}</td>
                      <td className="qty-col">{item.qty}</td>
                      <td className="price-col">{item.price.toFixed(2)}</td>
                      <td className="total-col">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="status-section">
            <div className="items-title" style={{ marginBottom: "10px" }}>Order Status</div>
            <div className="status-row">
              <span className="status-label">Entry</span>
              <span className="status-done">Completed - {formatDate(order.entryDate)}</span>
            </div>
            <div className="status-row">
              <span className="status-label">Washing</span>
              <span className={order.washingDone ? "status-done" : "status-pending"}>
                {order.washingDone ? `Completed - ${formatDate(order.washingDate)}` : "Pending"}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Packing</span>
              <span className={order.packingDone ? "status-done" : "status-pending"}>
                {order.packingDone ? `Completed - ${formatDate(order.packingDate)}` : "Pending"}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Delivery</span>
              <span className={order.delivered ? "status-done" : "status-pending"}>
                {order.delivered ? `Completed - ${formatDate(order.deliveryDate)}` : "Pending"}
              </span>
            </div>
          </div>

          {order.notes && (
            <div className="items-section">
              <div className="items-title">Notes</div>
              <div className="items-list">{order.notes}</div>
            </div>
          )}

          <div className="totals">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>{totalAmount.toFixed(2)} AED</span>
            </div>
            {(discountPercent > 0 || discountAmount > 0) && (
              <div className="total-row" style={{ color: "#f59e0b" }}>
                <span>Discount {discountPercent > 0 ? `(${discountPercent}%)` : ''}:</span>
                <span>-{discountAmount.toFixed(2)} AED</span>
              </div>
            )}
            {(discountPercent > 0 || discountAmount > 0) && (
              <div className="total-row" style={{ fontWeight: 600 }}>
                <span>Total After Discount:</span>
                <span>{finalAmount.toFixed(2)} AED</span>
              </div>
            )}
            <div className="total-row" style={{ color: "#16a34a" }}>
              <span>Paid Amount:</span>
              <span>{paidAmount.toFixed(2)} AED</span>
            </div>
            <div className="total-row">
              <span>Order Balance:</span>
              <span style={{ color: balance > 0 ? "#dc2626" : "#16a34a" }}>
                {balance.toFixed(2)} AED
              </span>
            </div>
            {order.paymentMethod && (
              <div className="total-row" style={{ fontSize: "12px", color: "#666" }}>
                <span>Payment Method:</span>
                <span style={{ textTransform: "capitalize" }}>{order.paymentMethod}</span>
              </div>
            )}
            {client && (
              <div className="total-row grand-total">
                <span>Client Total Due:</span>
                <span style={{ color: parseFloat(client.balance || "0") > 0 ? "#dc2626" : "#16a34a" }}>
                  {parseFloat(client.balance || "0").toFixed(2)} AED
                </span>
              </div>
            )}
          </div>

          <div className="footer">
            <p>Thank you for choosing {companyInfo.name}!</p>
            <p style={{ marginTop: "8px" }}>For inquiries, please contact us at {companyInfo.phone}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
