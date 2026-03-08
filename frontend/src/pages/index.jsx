import React from 'react';
import { Navigate } from 'react-router-dom';

const IndexPage = () => {
  const hasToken = !!localStorage.getItem('token');
  return <Navigate to={hasToken ? '/dashboard' : '/login'} replace />;
};

export default IndexPage;

