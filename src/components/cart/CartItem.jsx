import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';

export default function CartItem({ item, updateQuantity, removeFromCart }) {
  const productId = item.product._id || item.product.id;
  const image = getPrimaryImageUrl(item.product.images);
  return (
    <div className="flex gap-3 rounded-xl bg-white p-3 shadow-sm md:gap-4 md:rounded-3xl md:p-4">
      {image ? <img src={normalizeImageUrl(image)} alt="" className="h-24 w-20 shrink-0 rounded-xl object-cover md:h-28 md:w-24 md:rounded-2xl" /> : <div className="h-24 w-20 shrink-0 rounded-xl bg-gradient-to-br from-blush to-[#f8e5c6] md:h-28 md:w-24 md:rounded-2xl" />}
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3">
          <div>
            <h3 className="truncate text-sm font-black text-charcoal">{item.product.name}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Size: {item.size} | Color: {item.color}</p>
          </div>
          <button onClick={() => removeFromCart(productId)} className="text-sm font-black text-rose">Remove</button>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center rounded-full border border-slate-200">
            <button onClick={() => updateQuantity(productId, item.quantity - 1)} className="h-9 w-9 font-black">-</button>
            <span className="w-8 text-center text-sm font-black">{item.quantity}</span>
            <button onClick={() => updateQuantity(productId, item.quantity + 1)} className="h-9 w-9 font-black">+</button>
          </div>
          <p className="text-sm font-black">Rs. {item.product.price * item.quantity}</p>
        </div>
      </div>
    </div>
  );
}
