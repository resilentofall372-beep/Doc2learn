import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Stable identity matters: pages list addNotification in effect dependencies.
  const addNotification = useCallback(
    (notification) => {
      const id = Date.now() + Math.random();
      setNotifications((prev) => [...prev.slice(-4), { ...notification, id }]);
      setTimeout(() => removeNotification(id), 5000);
    },
    [removeNotification]
  );

  const value = useMemo(
    () => ({ notifications, addNotification, removeNotification }),
    [notifications, addNotification, removeNotification]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
