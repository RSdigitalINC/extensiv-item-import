import React, { useState, useCallback, Component } from "react";

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 32, fontFamily: "sans-serif", color: "#d00" }}><strong>App error:</strong> {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}
import {
  Page, Card, BlockStack, InlineStack, Text, TextField,
  Button, Banner, Badge, Divider, Box, List,
} from "@shopify/polaris";
import { getSessionToken } from "@shopify/app-bridge/utilities";
import { useAppBridge } from "@shopify/app-bridge-react";

function AppInner() {
  const app = useAppBridge();
  const [customerCode, setCustomerCode] = useState(import.meta.env.VITE_EXTENSIV_CUSTOMER_CODE ?? "");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true); setSuccess(null); setError(null);
    try {
      const sessionToken = await getSessionToken(app);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionToken}` },
        body: JSON.stringify({ customerCode, tag: tag.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? err.error ?? `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const tagSuffix = tag.trim() ? `_${tag.trim().replace(/\s+/g, "-")}` : "";
      const filename = `Item_Import_Template_${customerCode}${tagSuffix}_${date}.xlsx`;
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setSuccess(`${filename} downloaded successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [app, customerCode]);

  return (
    <Page title="Extensiv Item Import Generator" subtitle="Export your Shopify catalogue into a ready-to-upload Extensiv template">
      <BlockStack gap="400">
        <Banner tone="info">
          <Text as="p">Pulls all products from this store and generates an Extensiv <strong>Item Import Template (.xlsx)</strong> — barcodes mapped to SKU &amp; UPC, descriptions built from Vendor, Title, and Variant.</Text>
        </Banner>
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">Generate Template</Text>
            <Divider />
            <TextField label="Extensiv Customer Code" helpText="Identifies your warehouse account. Appears in the filename (e.g. IWGUSA11)." value={customerCode} onChange={setCustomerCode} autoComplete="off" maxLength={20} />
            <TextField label="Filter by Tag (optional)" helpText="Only export products with this tag. Leave blank to export all products." value={tag} onChange={setTag} autoComplete="off" />
            <InlineStack align="start">
              <Button variant="primary" size="large" loading={loading} onClick={handleGenerate} disabled={!customerCode.trim()}>
                {loading ? "Generating…" : "Generate & Download"}
              </Button>
            </InlineStack>
            {success && <Banner tone="success" onDismiss={() => setSuccess(null)}><Text as="p">✅ {success}</Text></Banner>}
            {error && <Banner tone="critical" onDismiss={() => setError(null)}><Text as="p">{error}</Text></Banner>}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h2">Field Mapping</Text>
              <Badge tone="info">Reference</Badge>
            </InlineStack>
            <Divider />
            <Box paddingBlockStart="200">
              <BlockStack gap="150">
                {[
                  ["SKU", "Variant barcode"],
                  ["UPC", "Variant barcode (same value)"],
                  ["Description", "Vendor — Product Title — Variant Title"],
                  ["Primary UOM", "Each"],
                  ["Packaging", "Carton / Qty 12"],
                  ["Dimensions", "1 × 1 × 1, Weight 1"],
                  ["Track fields", "FALSE"],
                ].map(([field, source]) => (
                  <InlineStack key={field} gap="300">
                    <Box minWidth="160px"><Text variant="bodyMd" fontWeight="semibold" as="span">{field}</Text></Box>
                    <Text variant="bodyMd" tone="subdued" as="span">{source}</Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Before Uploading to Extensiv</Text>
            <Divider />
            <List type="number">
              <List.Item>Open the downloaded .xlsx file</List.Item>
              <List.Item>Delete rows 1 and 2 (title row and header row)</List.Item>
              <List.Item>Save as <strong>Tab-Delimited Text (.txt)</strong></List.Item>
              <List.Item>Upload via the Extensiv Item Import screen</List.Item>
            </List>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}
