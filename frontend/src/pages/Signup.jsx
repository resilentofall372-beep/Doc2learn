import { useAuth } from '../contexts/AuthContext';
import { validateSignup } from '../utils/validators';
import AuthForm from '../components/common/AuthForm';

const FIELDS = [
  { name: 'name', label: 'Full name', type: 'text', autoComplete: 'name', placeholder: 'Asha Rao' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@university.edu' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 6 characters.' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
];

const Signup = () => {
  const { signup } = useAuth();
  return (
    <AuthForm
      title="Create your account"
      subtitle="Free, and your documents stay private to you."
      footer={{ text: 'Already have an account?', to: '/login', link: 'Sign in' }}
      fields={FIELDS}
      validate={validateSignup}
      submit={({ name, email, password }) => signup({ name, email, password })}
      submitLabel="Create account"
    />
  );
};

export default Signup;
