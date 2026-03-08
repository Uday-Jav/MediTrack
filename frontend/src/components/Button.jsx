import React from 'react';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  fullWidth = false,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    // using the robust class defined in index.css
    primary: "btn-primary",
    secondary: "bg-surface-50 border border-slate-200/60 shadow-sm text-slate-700 hover:border-brand-500/50 hover:text-brand-600 hover:shadow-md focus:ring-brand-500 backdrop-blur-sm",
    outline: "border-2 border-brand-500 text-brand-600 hover:bg-brand-50/50 hover:shadow-glow focus:ring-brand-500 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 focus:ring-slate-500"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg"
  };

  const widthClass = fullWidth ? "w-full" : "";
  const variantClass = variants[variant] || variants.primary;
  const sizeClass = sizes[size] || sizes.md;

  return (
    <button 
      className={`${baseStyles} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
      {...props}
    >
      {Object.keys(variants).includes(variant) && variant === 'primary' ? (
        <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
