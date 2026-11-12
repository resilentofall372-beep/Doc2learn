import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 mt-auto transition-colors duration-200">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-primary-600 dark:bg-primary-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">D2L</span>
            </div>
            <span className="text-lg font-heading font-bold text-gray-900 dark:text-white">
              Doc2Learn
            </span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Doc2Learn. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;