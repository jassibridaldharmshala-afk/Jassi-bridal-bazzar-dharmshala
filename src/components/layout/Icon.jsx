import {
  BarChart3,
  Bookmark,
  Box,
  Filter,
  Grid2x2,
  Heart,
  Home,
  Menu,
  Package,
  Search,
  Share2,
  ShoppingBag,
  Star,
  Trash2,
  User,
} from 'lucide-react';

const icons = {
  search: Search,
  heart: Heart,
  bag: ShoppingBag,
  user: User,
  menu: Menu,
  home: Home,
  grid: Grid2x2,
  filter: Filter,
  star: Star,
  chart: BarChart3,
  box: Box,
  share: Share2,
  trash: Trash2,
  bookmark: Bookmark,
  package: Package,
};

export default function Icon({ name, className = 'h-5 w-5' }) {
  const Component = icons[name] || Home;
  return <Component className={className} strokeWidth={1.9} aria-hidden="true" />;
}
