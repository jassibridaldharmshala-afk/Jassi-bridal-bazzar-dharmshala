import { useEffect } from 'react';
import { beginAdminActivity, isAdminWorkspace } from '../utils/adminActivity';

export default function useAdminActivity(active, label, kind = 'loading') {
  useEffect(() => {
    if (!active || !isAdminWorkspace()) return undefined;
    return beginAdminActivity({ kind, label, action: false }).finish;
  }, [active, label, kind]);
}
