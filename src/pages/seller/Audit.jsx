import AuditExplorer from '../../components/admin/AuditExplorer';

export default function Audit() {
  return <AuditExplorer endpoint="/seller/audit-logs" seller />;
}
