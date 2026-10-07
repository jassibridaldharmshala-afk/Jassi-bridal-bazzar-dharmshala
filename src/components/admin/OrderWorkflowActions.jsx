import { AlertTriangle, Check, ExternalLink, PackageCheck, RotateCcw, Truck, Wallet, XCircle } from 'lucide-react';

const ACTIONS = {
  CONFIRM_ORDER: { label: 'Confirm order', status: 'Confirmed', Icon: Check, primary: true },
  MARK_PACKED: { label: 'Mark packed', status: 'Packed', Icon: PackageCheck, primary: true },
  MARK_SHIPPED: { label: 'Mark shipped', status: 'Shipped', Icon: Truck, primary: true },
  MARK_OUT_FOR_DELIVERY: { label: 'Out for delivery', status: 'Out for Delivery', Icon: Truck, primary: true },
  MARK_DELIVERED: { label: 'Mark delivered', status: 'Delivered', Icon: Check, primary: true },
  CANCEL_ORDER: { label: 'Cancel order', Icon: XCircle, danger: true },
  COLLECT_COD: { label: 'Record COD', Icon: Wallet, primary: true },
  RECORD_COD_REFUND: { label: 'Record refund', Icon: RotateCcw, danger: true },
  RESOLVE_DELIVERY_EXCEPTION: { label: 'Resolve delivery issue', Icon: AlertTriangle, danger: true },
  REVIEW_RETURN: { label: 'Review return', Icon: ExternalLink },
};

function fallbackActions(order) {
  const values = [];
  const integrated = order.shipment?.provider && order.shipment.provider !== 'manual';
  const tracking = order.shipment?.awb || order.shipment?.trackingNumber;
  if (order.orderStatus === 'Pending' && (order.paymentMethod === 'COD' || order.paymentStatus === 'Paid')) values.push('CONFIRM_ORDER');
  if (order.orderStatus === 'Confirmed') values.push('MARK_PACKED');
  if (order.orderStatus === 'Packed' && !integrated && tracking) values.push('MARK_SHIPPED');
  if (order.orderStatus === 'Shipped' && !integrated) values.push('MARK_OUT_FOR_DELIVERY');
  if (order.orderStatus === 'Out for Delivery' && !integrated) values.push('MARK_DELIVERED');
  if (['Pending', 'Confirmed', 'Packed'].includes(order.orderStatus)) values.push('CANCEL_ORDER');
  if (order.paymentMethod === 'COD' && order.paymentStatus === 'Pending' && order.orderStatus === 'Delivered') values.push('COLLECT_COD');
  if (/Return|Exchange|Refund/.test(order.orderStatus || '')) values.push('REVIEW_RETURN');
  return values;
}

export default function OrderWorkflowActions({ order, busy, onStatus, onCancel, onCollectCod, onRefund, onResolveException, returnHref, compact = false }) {
  const allowed = Array.isArray(order.allowedActions) ? order.allowedActions : fallbackActions(order);
  const visible = compact ? allowed.filter(action => !['REVIEW_RETURN', 'RECORD_COD_REFUND', 'RESOLVE_DELIVERY_EXCEPTION'].includes(action)).slice(0, 2) : allowed;
  if (!visible.length) return <span className="order-workflow-complete">No action needed</span>;
  return <div className={`order-workflow-actions ${compact ? 'is-compact' : ''}`}>
    {visible.map(action => {
      const config = ACTIONS[action];
      if (!config) return null;
      const { Icon } = config;
      if (action === 'REVIEW_RETURN') return <a key={action} href={returnHref} className="order-action-btn"><Icon size={14} />{config.label}</a>;
      return <button
        key={action}
        type="button"
        disabled={busy}
        className={`order-action-btn ${config.primary ? 'is-primary' : ''} ${config.danger ? 'is-danger' : ''}`}
        onClick={() => action === 'CANCEL_ORDER' ? onCancel?.(order) : action === 'COLLECT_COD' ? onCollectCod?.(order) : action === 'RECORD_COD_REFUND' ? onRefund?.(order) : action === 'RESOLVE_DELIVERY_EXCEPTION' ? onResolveException?.(order) : onStatus?.(order, config.status, config.label)}
      ><Icon size={14} />{config.label}</button>;
    })}
  </div>;
}
