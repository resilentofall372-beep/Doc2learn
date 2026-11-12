import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { validateSignup } from '../utils/validators';
import AuthLayout from '../components/common/AuthLayout';
import LoadingSpinner from '../components/common/LoadingSpinner';

const FIELDS = [
  { name: 'name', label: 'Full name', type: 'text', autoComplete: 'name', placeholder: 'Asha Rao' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@university.edu' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 6 characters.' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
];

const Signup = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const update = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setFormError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateSignup(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setLoading(true);
    const result = await signup({ name: form.name, email: form.email, password: form.password });
    setLoading(false);
    if (result.success) navigate('/dashboard');
    else setFormError(result.error);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, and your documents stay private to you."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        {formError && <div className="alert alert-danger">{formError}</div>}
        {FIELDS.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="label">{field.label}</label>
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              className="input"
              value={form[field.name]}
              onChange={update}
            />
            {errors[field.name] ? <p className="field-error">{errors[field.name]}</p> : field.hint && <p className="hint">{field.hint}</p>}
          </div>
        ))}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? <LoadingSpinner size="small" /> : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Signup;
