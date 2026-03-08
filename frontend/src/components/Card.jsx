import React from 'react';

const Card = ({ children, className = '', noPadding = false, ...props }) => {
  return (
    <div 
      className={`bg-white rounded-2xl shadow-soft border border-slate-100 transition-shadow hover:shadow-premium ${noPadding ? '' : 'p-6 sm:p-8'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
