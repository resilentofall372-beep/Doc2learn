import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateLogin } from '../utils/validators';
import AuthLayout from '../components/common/AuthLayout';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setFormError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateLogin(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setLoading(true);
    const result = await login(form);
    setLoading(false);
    if (result.success) navigate('/dashboard');
    else setFormError(result.error);
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <>
          New to Doc2Learn?{' '}
          <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        {formError && <div className="alert alert-danger">{formError}</div>}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" className="input" placeholder="you@university.edu" value={form.email} onChange={update} />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" className="input" value={form.password} onChange={update} />
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? <LoadingSpinner size="small" /> : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
