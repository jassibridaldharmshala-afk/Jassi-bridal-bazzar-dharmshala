import Login from './Login';
export default function Register({ route = '/register' }) {
  return <Login route={route.replace(/^\/register(?=\?|$)/, '/login')} />;
}
