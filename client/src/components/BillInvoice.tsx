import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, X } from "lucide-react";

interface BillInvoiceProps {
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  items?: { description: string; amount: number }[];
  billAmount: number;
  previousBalance: number;
  totalDue: number;
  onClose?: () => void;
}

const companyInfo = {
  name: "Liquid Washes Laundry",
  address: "Centra Market D/109, Al Dhanna City, Al Ruwais",
  city: "Abu Dhabi, UAE",
  phone: "+971 50 123 4567",
};

export function BillInvoice({
  invoiceNumber,
  date,
  clientName,
  clientPhone,
  clientAddress,
  items = [],
  billAmount,
  previousBalance,
  totalDue,
  onClose,
}: BillInvoiceProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (invoiceRef.current) {
      const printContent = invoiceRef.current.innerHTML;
      const printWindow = window.open("", "_blank", "width=800,height=600");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Bill Invoice ${invoiceNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                background: white; 
                color: #333;
              }
              .invoice-container { max-width: 600px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e40af; padding-bottom: 20px; }
              .company-name { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
              .company-address { font-size: 12px; color: #666; line-height: 1.5; }
              .invoice-title { font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0; color: #1e40af; }
              .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .info-section { width: 48%; }
              .info-label { font-size: 12px; color: #666; margin-bottom: 4px; }
              .info-value { font-size: 14px; font-weight: 500; }
              .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
              .items-table th { background: #f3f4f6; font-weight: 600; }
              .items-table .amount { text-align: right; }
              .totals { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e5e5; }
              .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
              .total-row.grand-total { font-size: 18px; font-weight: bold; color: #dc2626; border-top: 2px solid #1e40af; margin-top: 10px; padding-top: 15px; }
              .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid #e5e5e5; }
              .footer p { font-size: 12px; color: #666; }
              .status-badge { display: inline-block; background: #dc2626; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-white">
        <div className="flex items-center justify-between p-4 border-b bg-destructive/5">
          <h2 className="text-lg font-semibold text-foreground">Bill Invoice</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-bill-invoice">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            {onClose && (
              <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-bill-invoice">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div ref={invoiceRef} className="p-6 invoice-container">
          <div className="header">
            <div className="company-name">{companyInfo.name}</div>
            <div className="company-address">
              {companyInfo.address}<br />
              {companyInfo.city}<br />
              {companyInfo.phone}
            </div>
          </div>

          <div className="invoice-title">BILL INVOICE</div>

          <div className="info-row">
            <div className="info-section">
              <div className="info-label">Invoice No.</div>
              <div className="info-value">{invoiceNumber}</div>
            </div>
            <div className="info-section" style={{ textAlign: "right" }}>
              <div className="info-label">Date</div>
              <div className="info-value">{new Date(date).toLocaleDateString("en-AE", { 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
              })}</div>
            </div>
          </div>

          <div className="info-row">
            <div className="info-section">
              <div className="info-label">Bill To</div>
              <div className="info-value">{clientName}</div>
              {clientPhone && <div className="info-value" style={{ fontSize: "12px", color: "#666" }}>{clientPhone}</div>}
              {clientAddress && <div className="info-value" style={{ fontSize: "12px", color: "#666" }}>{clientAddress}</div>}
            </div>
          </div>

          {items.length > 0 && (
            <table className="items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="amount">Amount (AED)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.description}</td>
                    <td className="amount">{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="totals">
            {previousBalance > 0 && (
              <div className="total-row">
                <span>Previous Balance:</span>
                <span>{previousBalance.toFixed(2)} AED</span>
              </div>
            )}
            <div className="total-row" style={{ color: "#1e40af", fontWeight: 600 }}>
              <span>New Bill Amount:</span>
              <span>{billAmount.toFixed(2)} AED</span>
            </div>
            <div className="total-row grand-total">
              <span>Total Amount Due:</span>
              <span>{totalDue.toFixed(2)} AED</span>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <span className="status-badge">
              PAYMENT DUE
            </span>
          </div>

          <div className="footer">
            <p>Thank you for your business!</p>
            <p style={{ marginTop: "8px" }}>Please settle payment at your earliest convenience.</p>
            <p style={{ marginTop: "8px" }}>For inquiries, please contact us at {companyInfo.phone}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
