import { useAuth } from '../contexts/AuthContext';
import { validateLogin } from '../utils/validators';
import AuthForm from '../components/common/AuthForm';

const FIELDS = [
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@university.edu' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
];

const Login = () => {
  const { login } = useAuth();
  return (
    <AuthForm
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={{ text: 'New to Doc2Learn?', to: '/signup', link: 'Create an account' }}
      fields={FIELDS}
      validate={validateLogin}
      submit={login}
      submitLabel="Sign in"
    />
  );
};

export default Login;
