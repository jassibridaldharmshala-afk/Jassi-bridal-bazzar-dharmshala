import { AdminLoadingPlaceholder } from './AdminActivityIndicator';

export default function Loader({ label = 'Loading...' }) {
  return <AdminLoadingPlaceholder label={label} />;
}
