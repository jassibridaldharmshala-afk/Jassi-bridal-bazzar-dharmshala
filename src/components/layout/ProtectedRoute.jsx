import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return (
      <section className="container-page py-16">
        <div className="mx-auto max-w-lg rounded-xl bg-white p-5 text-center shadow-xl md:rounded-3xl md:p-8">
          <h1 className="text-2xl font-black text-charcoal">Login required</h1>
          <p className="mt-3 text-sm text-slate-600">Please login to access this shopping feature.</p>
          <a href="/login" className="mt-6 inline-flex rounded-full bg-wine px-6 py-3 text-sm font-black text-white">Login now</a>
        </div>
      </section>
    );
  }
  return children;
}
