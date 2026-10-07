import WebsiteCustomizer from '../admin/WebsiteCustomizer';

// Both platform owners and sellers use the same safe editor. WebsiteCustomizer
// selects tenant-scoped seller APIs in this mode, so drafts never cross stores.
export default function StoreDesigner() {
  return <WebsiteCustomizer mode="seller" />;
}
