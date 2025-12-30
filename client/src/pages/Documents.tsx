import Navigation from "@/components/Navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Upload, FileText, Download, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Documents() {
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("commercial_invoice");
  const [selectedShipment, setSelectedShipment] = useState<number | null>(null);

  const { data: documents, refetch } = trpc.documents.list.useQuery({});
  const { data: shipments } = trpc.shipments.list.useQuery();
  
  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      refetch();
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          mimeType: file.type,
          documentType: selectedType,
          shipmentId: selectedShipment || undefined,
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploading(false);
      toast.error("Upload failed");
    }
  };

  const documentTypes = [
    { value: "commercial_invoice", label: "Commercial Invoice" },
    { value: "packing_list", label: "Packing List" },
    { value: "certificate_of_origin", label: "Certificate of Origin" },
    { value: "bill_of_lading", label: "Bill of Lading" },
    { value: "customs_declaration", label: "Customs Declaration" },
    { value: "inspection_certificate", label: "Inspection Certificate" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container py-12">
        <div className="mb-8">
          <div className="w-2 h-12 bg-primary mb-4"></div>
          <h1 className="text-4xl font-bold mb-2">Trade Documents</h1>
          <p className="text-muted-foreground">
            Secure cloud storage for all your trade documentation
          </p>
        </div>

        {/* Upload Section */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Upload Document</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Document Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Link to Shipment (Optional)</label>
              <Select
                value={selectedShipment?.toString() || "none"}
                onValueChange={(v) => setSelectedShipment(v === "none" ? null : parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No shipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No shipment</SelectItem>
                  {shipments?.map((shipment: any) => (
                    <SelectItem key={shipment.id} value={shipment.id.toString()}>
                      {shipment.shipmentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">File</label>
              <Input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
            </div>
          </div>
          {uploading && (
            <div className="text-sm text-muted-foreground">
              <Upload className="w-4 h-4 inline mr-2 animate-spin" />
              Uploading...
            </div>
          )}
        </Card>

        {/* Documents List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Your Documents</h2>
          {!documents || documents.length === 0 ? (
            <Card className="p-12 text-center">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No documents uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Upload your first trade document using the form above
              </p>
            </Card>
          ) : (
            documents.map((doc: any) => (
              <Card key={doc.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">{doc.fileName}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="outline">
                          {documentTypes.find((t) => t.value === doc.documentType)?.label || doc.documentType}
                        </Badge>
                        <span>Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                        {doc.fileSize && <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>}
                      </div>
                      {doc.shipmentId && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Linked to: {shipments?.find((s: any) => s.id === doc.shipmentId)?.shipmentName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this document?")) {
                          deleteMutation.mutate({ documentId: doc.id });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
