import { useRef, useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, X } from "lucide-react";
import type { Order, Client, Product } from "@shared/schema";
import logoImage from "@assets/image_1769169126339.png";
import paidStampImage from "@assets/image_1767486604951.png";

interface OrderReceiptProps {
  order: Order;
  client?: Client;
  onClose?: () => void;
}

const companyInfo = {
  name: "Liquid Washes Laundry",
  address: "Centra Market D/109, Al Dhanna City, Al Ruwais",
  city: "Abu Dhabi, UAE",
  phone: "Tel: 026 815 824 | Mobile: +971 56 338 0001",
};

export function OrderReceipt({ order, client, onClose }: OrderReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [logoBase64, setLogoBase64] = useState<string>("");
  const [paidStampBase64, setPaidStampBase64] = useState<string>("");

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

    const stampImg = new Image();
    stampImg.crossOrigin = "anonymous";
    stampImg.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = stampImg.width;
      canvas.height = stampImg.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(stampImg, 0, 0);
        setPaidStampBase64(canvas.toDataURL("image/png"));
      }
    };
    stampImg.src = paidStampImage;
  }, []);

  const parsedItems = useMemo(() => {
    if (!order.items) return [];
    const itemParts = order.items.split(",").map(s => s.trim());
    return itemParts.map(part => {
      const match = part.match(/^(\d+)x\s+(.+)$/i);
      if (match) {
        const qty = parseInt(match[1]);
        const name = match[2].trim();
        // Extract base product name (remove variations like "(folding)", "(hanging)")
        const baseName = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
        // Try exact match first, then base name match
        let product = products?.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (!product) {
          product = products?.find(p => p.name.toLowerCase() === baseName.toLowerCase());
        }
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
              @page { 
                size: 80mm auto; 
                margin: 0; 
              }
              body { 
                font-family: 'Courier New', monospace; 
                padding: 5mm; 
                background: white; 
                color: #000;
                width: 80mm;
                font-size: 10px;
              }
              .receipt-container { width: 100%; }
              .header { text-align: center; margin-bottom: 8px; border-bottom: 1px dashed ${order.urgent ? "#dc2626" : "#000"}; padding-bottom: 8px; }
              .logo { width: 50px; height: 50px; margin: 0 auto 5px; }
              .logo img { width: 100%; height: 100%; object-fit: contain; }
              .company-info { text-align: center; }
              .company-name { font-size: 14px; font-weight: bold; color: ${order.urgent ? "#dc2626" : "#000"}; margin-bottom: 3px; }
              .company-address { font-size: 9px; color: #333; line-height: 1.3; }
              .receipt-title { font-size: 12px; font-weight: bold; text-align: center; margin: 8px 0; color: ${order.urgent ? "#dc2626" : "#000"}; }
              .service-type-banner { text-align: center; padding: 5px; margin: 5px 0; font-weight: bold; font-size: 11px; border: 1px solid ${order.urgent ? "#dc2626" : "#000"}; }
              .info-row { margin-bottom: 5px; font-size: 9px; }
              .info-section { margin-bottom: 3px; }
              .info-label { font-size: 8px; color: #666; }
              .info-value { font-size: 10px; font-weight: bold; }
              .order-number { font-size: 14px; font-weight: bold; color: ${order.urgent ? "#dc2626" : "#000"}; text-align: center; margin: 8px 0; padding: 5px; border: 1px dashed #000; }
              .items-section { margin: 8px 0; }
              .items-title { font-weight: bold; margin-bottom: 5px; font-size: 10px; }
              .items-table { width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #000; }
              .items-table th, .items-table td { padding: 4px 3px; text-align: left; border: 1px solid #000; }
              .items-table th { font-weight: bold; font-size: 8px; text-transform: uppercase; background: #f0f0f0; }
              .items-table .qty-col { text-align: center; width: 25px; }
              .items-table .price-col { text-align: right; width: 45px; }
              .items-table .total-col { text-align: right; width: 50px; font-weight: bold; }
              .status-section { margin: 8px 0; font-size: 9px; }
              .status-row { display: flex; justify-content: space-between; padding: 2px 0; }
              .status-done { font-weight: bold; }
              .status-pending { color: #dc2626; }
              .totals { margin-top: 8px; padding-top: 5px; border-top: 1px dashed #000; font-size: 10px; }
              .total-row { display: flex; justify-content: space-between; padding: 2px 0; }
              .total-row.grand-total { font-size: 14px; font-weight: bold; color: ${order.urgent ? "#dc2626" : "#000"}; border-top: 2px solid ${order.urgent ? "#dc2626" : "#000"}; margin-top: 5px; padding-top: 5px; }
              .footer { margin-top: 10px; text-align: center; padding-top: 8px; border-top: 1px dashed #000; }
              .footer p { font-size: 8px; color: #666; }
              .delivery-badge { display: inline-block; padding: 2px 6px; font-size: 9px; margin-top: 5px; border: 1px solid #000; }
              .delivery-type { background: #eee; }
              .urgent-badge { background: #dc2626; color: white; border-color: #dc2626; margin-left: 4px; }
              @media print { 
                body { padding: 2mm; width: 80mm; } 
                .no-print { display: none; } 
              }
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
              <div className="company-name" style={order.urgent ? { color: "#dc2626" } : {}}>{companyInfo.name}</div>
              <div className="company-address">
                {companyInfo.address}<br />
                {companyInfo.city}<br />
                {companyInfo.phone}
              </div>
            </div>
          </div>

          <div className="receipt-title" style={order.urgent ? { color: "#dc2626" } : {}}>ORDER RECEIPT</div>

          {/* Service Type Banner */}
          <div style={{
            textAlign: "center",
            padding: "12px",
            marginBottom: "15px",
            borderRadius: "8px",
            fontWeight: "bold",
            fontSize: "16px",
            background: order.urgent ? "#fef2f2" : "#f0f9ff",
            color: order.urgent ? "#dc2626" : "#1e40af",
            border: order.urgent ? "2px solid #dc2626" : "2px solid #1e40af"
          }}>
            {order.urgent ? "URGENT SERVICE" : "NORMAL SERVICE"}
          </div>

          <div className="order-number" style={order.urgent ? { color: "#dc2626", background: "#fef2f2" } : {}}>
            Order # {order.orderNumber}
            <div style={{ marginTop: "8px" }}>
              <span className="delivery-badge delivery-type">
                {order.deliveryType === "delivery" ? "for delivery" : "for pickup"}
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
              <table className="items-table" style={{ border: "1px solid #000", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ width: "30px", textAlign: "center", border: "1px solid #000", padding: "6px 4px", background: "#f0f0f0" }}>#</th>
                    <th style={{ border: "1px solid #000", padding: "6px 4px", background: "#f0f0f0" }}>Item</th>
                    <th className="qty-col" style={{ border: "1px solid #000", padding: "6px 4px", background: "#f0f0f0" }}>Qty</th>
                    <th className="price-col" style={{ border: "1px solid #000", padding: "6px 4px", background: "#f0f0f0" }}>Price</th>
                    <th className="total-col" style={{ border: "1px solid #000", padding: "6px 4px", background: "#f0f0f0" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", border: "1px solid #000", padding: "6px 4px" }}>{idx + 1}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 4px" }}>{item.name}</td>
                      <td className="qty-col" style={{ border: "1px solid #000", padding: "6px 4px" }}>{item.qty}</td>
                      <td className="price-col" style={{ border: "1px solid #000", padding: "6px 4px" }}>{item.price.toFixed(2)}</td>
                      <td className="total-col" style={{ border: "1px solid #000", padding: "6px 4px" }}>{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="totals">
            <div className="total-row grand-total" style={{ fontSize: "16px" }}>
              <span>Amount Due:</span>
              <span style={{ color: balance > 0 ? "#dc2626" : "#16a34a" }}>
                {balance.toFixed(2)} AED
              </span>
            </div>
          </div>

          {balance <= 0 && paidAmount > 0 && (
            <div style={{
              textAlign: "center",
              padding: "15px",
              marginTop: "15px",
              marginBottom: "10px",
            }}>
              <img 
                src={paidStampBase64 || paidStampImage} 
                alt="PAID" 
                style={{
                  width: "120px",
                  height: "120px",
                  margin: "0 auto",
                  display: "block",
                }}
              />
              <div style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#dc2626",
                marginTop: "8px",
                textTransform: "uppercase",
              }}>
                {order.paymentMethod === "bank" ? "Bank Transfer" : 
                 order.paymentMethod === "card" ? "Card" : "Cash"}
              </div>
            </div>
          )}

          <div className="footer">
            <p>Thank you for choosing {companyInfo.name}!</p>
            <p style={{ marginTop: "8px" }}>For inquiries, please contact us at {companyInfo.phone}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
