import React from 'react';
import { useApp } from '../../contexts/AppContext';

const Notification = () => {
  const { notifications, removeNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg shadow-lg border-l-4 slide-up ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-500 text-green-700'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-500 text-red-700'
              : 'bg-blue-50 border-blue-500 text-blue-700'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{notification.title}</p>
              <p className="text-sm mt-1">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="ml-4 text-gray-400 hover:text-gray-600 text-lg"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Notification;