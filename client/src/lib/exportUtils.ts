import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Export tariff calculation as PDF
export function exportTariffPDF(data: {
  htsCode: string;
  origin: string;
  destination: string;
  value: number;
  freight: number;
  insurance: number;
  appliedRate: string;
  dutyAmount: number;
  additionalDuties: number;
  totalDuties: number;
  landedCost: number;
  tradeAgreement?: string;
  calculationDate: string;
}) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text("CochitoCorp iTCP", 14, 20);
  doc.setFontSize(12);
  doc.text("Tariff Calculation Report", 14, 28);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
  
  // Shipment Details
  doc.setFontSize(14);
  doc.text("Shipment Details", 14, 45);
  
  autoTable(doc, {
    startY: 50,
    head: [["Field", "Value"]],
    body: [
      ["HTS Code", data.htsCode],
      ["Origin Country", data.origin],
      ["Destination Country", data.destination],
      ["Merchandise Value", `$${data.value.toLocaleString()}`],
      ["Freight Cost", `$${data.freight.toLocaleString()}`],
      ["Insurance Cost", `$${data.insurance.toLocaleString()}`],
    ],
    theme: "striped",
    headStyles: { fillColor: [220, 20, 60] },
  });
  
  // Duty Breakdown
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.text("Duty Breakdown", 14, finalY);
  
  autoTable(doc, {
    startY: finalY + 5,
    head: [["Description", "Amount"]],
    body: [
      ["Duty Rate", data.appliedRate],
      ["Duty Amount", `$${data.dutyAmount.toLocaleString()}`],
      ["Additional Duties", `$${data.additionalDuties.toLocaleString()}`],
      ["Total Duties", `$${data.totalDuties.toLocaleString()}`],
      ...(data.tradeAgreement ? [["Trade Agreement", data.tradeAgreement]] : []),
    ],
    theme: "striped",
    headStyles: { fillColor: [220, 20, 60] },
  });
  
  // Total Landed Cost
  const finalY2 = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Landed Cost: $${data.landedCost.toLocaleString()}`, 14, finalY2);
  
  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("This calculation is for estimation purposes only. Consult with a customs broker for official rates.", 14, 280);
  
  // Save
  doc.save(`tariff-calculation-${data.htsCode}-${Date.now()}.pdf`);
}

// Export tariff calculation as CSV
export function exportTariffCSV(data: {
  htsCode: string;
  origin: string;
  destination: string;
  value: number;
  freight: number;
  insurance: number;
  appliedRate: string;
  dutyAmount: number;
  additionalDuties: number;
  totalDuties: number;
  landedCost: number;
  tradeAgreement?: string;
}) {
  const csvContent = [
    ["Field", "Value"],
    ["HTS Code", data.htsCode],
    ["Origin Country", data.origin],
    ["Destination Country", data.destination],
    ["Merchandise Value", data.value],
    ["Freight Cost", data.freight],
    ["Insurance Cost", data.insurance],
    ["Duty Rate", data.appliedRate],
    ["Duty Amount", data.dutyAmount],
    ["Additional Duties", data.additionalDuties],
    ["Total Duties", data.totalDuties],
    ["Total Landed Cost", data.landedCost],
    ...(data.tradeAgreement ? [["Trade Agreement", data.tradeAgreement]] : []),
    ["Generated Date", new Date().toISOString()],
  ]
    .map((row) => row.join(","))
    .join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tariff-calculation-${data.htsCode}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Export compliance checklist as PDF
export function exportChecklistPDF(data: {
  htsCode: string;
  origin: string;
  destination: string;
  items: Array<{
    task: string;
    description: string;
    priority: string;
    category: string;
    riskLevel: string;
    deadline?: string;
    consequences?: string;
    completed?: boolean;
  }>;
}) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text("CochitoCorp iTCP", 14, 20);
  doc.setFontSize(12);
  doc.text("Compliance Checklist", 14, 28);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
  
  // Shipment Info
  doc.setFontSize(10);
  doc.text(`HTS Code: ${data.htsCode}`, 14, 42);
  doc.text(`Route: ${data.origin} → ${data.destination}`, 14, 48);
  doc.text(`Total Items: ${data.items.length}`, 14, 54);
  
  let currentY = 65;
  
  // Checklist Items - Detailed format
  data.items.forEach((item, index) => {
    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    
    // Checkbox and Task
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const checkbox = item.completed ? "☑" : "☐";
    doc.text(`${checkbox} ${index + 1}. ${item.task}`, 14, currentY);
    currentY += 6;
    
    // Description
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(item.description, 180);
    doc.text(descLines, 18, currentY);
    currentY += descLines.length * 4 + 2;
    
    // Metadata row
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const metadata = [
      `Priority: ${item.priority}`,
      `Category: ${item.category}`,
      `Risk: ${item.riskLevel}`,
      item.deadline ? `Deadline: ${item.deadline}` : null
    ].filter(Boolean).join(" | ");
    doc.text(metadata, 18, currentY);
    currentY += 4;
    
    // Consequences if present
    if (item.consequences) {
      doc.setTextColor(220, 20, 60);
      doc.text(`⚠ ${item.consequences}`, 18, currentY);
      currentY += 4;
    }
    
    doc.setTextColor(0, 0, 0); // Reset color
    currentY += 4; // Space between items
  });
  
  // Footer
  doc.setFontSize(8);
  doc.text("Review all items before shipment. Consult with compliance experts for specific requirements.", 14, 280);
  
  // Save
  doc.save(`compliance-checklist-${data.htsCode}-${Date.now()}.pdf`);
}

// Export regulations as PDF
export function exportRegulationsPDF(data: {
  country: string;
  regulations: Array<{
    title: string;
    category: string;
    description: string;
    riskLevel: string;
    requirements: string[];
    documents: string[];
    authority?: string;
  }>;
}) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text("CochitoCorp iTCP", 14, 20);
  doc.setFontSize(12);
  doc.text("Regulations Summary", 14, 28);
  
  // Date and Country
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
  doc.text(`Country: ${data.country}`, 14, 41);
  doc.text(`Total Regulations: ${data.regulations.length}`, 14, 47);
  
  let currentY = 55;
  
  data.regulations.forEach((reg, index) => {
    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    
    // Regulation Title
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. ${reg.title}`, 14, currentY);
    currentY += 6;
    
    // Category and Risk
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Category: ${reg.category} | Risk: ${reg.riskLevel}`, 14, currentY);
    currentY += 5;
    
    // Description
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(reg.description, 180);
    doc.text(descLines, 14, currentY);
    currentY += descLines.length * 4 + 3;
    
    // Requirements
    if (reg.requirements.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Requirements:", 14, currentY);
      currentY += 4;
      doc.setFont("helvetica", "normal");
      reg.requirements.forEach((req) => {
        const reqLines = doc.splitTextToSize(`• ${req}`, 175);
        doc.text(reqLines, 18, currentY);
        currentY += reqLines.length * 4;
      });
      currentY += 2;
    }
    
    // Documents
    if (reg.documents.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Required Documents:", 14, currentY);
      currentY += 4;
      doc.setFont("helvetica", "normal");
      reg.documents.forEach((doc_name) => {
        const docLines = doc.splitTextToSize(`• ${doc_name}`, 175);
        doc.text(docLines, 18, currentY);
        currentY += docLines.length * 4;
      });
      currentY += 2;
    }
    
    currentY += 5; // Space between regulations
  });
  
  // Save
  doc.save(`regulations-${data.country}-${Date.now()}.pdf`);
}
