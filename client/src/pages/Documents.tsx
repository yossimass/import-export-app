import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FolderOpen, Upload, Trash2, Download, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Documents() {
  const documentsQuery = trpc.documents.list.useQuery();

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="container py-12">
        <div className="mb-12">
          <div className="relative inline-block">
            <div className="absolute -left-8 top-2 w-4 h-4 bg-primary"></div>
            <h1 className="text-4xl font-bold">Document Management</h1>
          </div>
          <div className="w-24 h-1 bg-black mt-4"></div>
          <p className="text-lg mt-4 text-muted-foreground">
            Secure cloud storage for trade documents.
          </p>
        </div>

        {documentsQuery.isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin mx-auto" />
          </div>
        ) : (
          <Card className="border-black">
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Document upload feature available</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
