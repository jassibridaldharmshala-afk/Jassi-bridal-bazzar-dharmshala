import { useContext } from 'react';
import { AdminFeedbackContext } from '../../context/AdminFeedbackContext';
import { adminFeedbackToast } from '../../hooks/useAdminFeedback';
import AppToast from '../ui/AppToast';

export default function AdminFeedback({ message, type = 'info', title = '', onDismiss = () => {} }) {
  const feedback = useContext(AdminFeedbackContext);
  // AuthProvider owns the single popup in the app. Standalone previews use the same UI.
  if (feedback.managed) return null;
  return <AppToast toast={adminFeedbackToast(message, type, title)} onDismiss={onDismiss} activeMode="admin" />;
}
