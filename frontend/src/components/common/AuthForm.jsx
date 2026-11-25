import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import LoadingSpinner from './LoadingSpinner';

/**
 * The sign-in and sign-up page: a field list, client-side validation, and a submit
 * call returning {success, error}. On success it goes to the projects list.
 */
const AuthForm = ({ title, subtitle, footer, fields, validate, submit, submitLabel }) => {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((f) => [f.name, ''])));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setFormError(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setLoading(true);
    const result = await submit(form);
    setLoading(false);
    if (result.success) navigate('/projects');
    else setFormError(result.error);
  };

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      footer={
        <>
          {footer.text}{' '}
          <Link to={footer.to} className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
            {footer.link}
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {formError && <div className="alert alert-danger">{formError}</div>}
        {fields.map((field) => (
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
          {loading ? <LoadingSpinner size="small" /> : submitLabel}
        </button>
      </form>
    </AuthLayout>
  );
};

export default AuthForm;
