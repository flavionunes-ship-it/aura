
import React, { ReactNode } from 'react';

interface CardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  footer?: ReactNode;
}

const Card: React.FC<CardProps> = ({ title, value, icon, footer }) => {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between">
            <div>
                <h5 className="text-sm font-medium text-gray-500 uppercase dark:text-gray-400">{title}</h5>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
            </div>
            <div className="p-3 text-primary-600 bg-primary-100 rounded-full dark:bg-primary-900 dark:text-primary-300">
                {icon}
            </div>
        </div>
        {footer && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {footer}
            </div>
        )}
    </div>
  );
};

export default Card;
