import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';

const NotFound = () => (
  <div className="card mx-auto mt-12 max-w-md">
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={<Link to="/dashboard" className="btn btn-primary">Go to library</Link>}
    />
  </div>
);

export default NotFound;
