import React, { useState } from 'react';
import { QrCode, Share2, ScanLine, AlertCircle, Fingerprint } from 'lucide-react';

const QRPage = () => {
  const [isCopied, setIsCopied] = useState(false);
  
  // Using a placeholder QR image. In a real app, this would be generated dynamically or fetched from the backend.
  const qrImageSrc = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=MediVault-PatientID-7819-Emergency-Access&color=0c4a6e";

  const handleShare = () => {
    // Mock sharing functionality
    if (navigator.share) {
      navigator.share({
        title: 'My MediVault Medical Record',
        text: 'Access my emergency medical history securely via this link.',
        url: window.location.href,
      }).catch(console.error);
    } else {
      // Fallback: Copy generic emergency ID
      navigator.clipboard.writeText("MT-EMERGENCY-ID-7819");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-8 text-center max-w-xl mx-auto">
        <div className="mx-auto h-16 w-16 bg-medical-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <QrCode className="h-8 w-8 text-medical-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Emergency Access</h1>
        <p className="text-gray-500 mt-2">Share this QR code with healthcare professionals to grant them temporary access to your vital medical history.</p>
      </div>

      <div className="card max-w-md mx-auto overflow-hidden relative">
        {/* Top Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-medical-400 to-medical-600 w-full"></div>
        
        <div className="p-8 pb-10 flex flex-col items-center border-b border-gray-100">
          <div className="relative mb-6">
            <div className="absolute -inset-4 border-2 border-dashed border-medical-200 rounded-3xl animate-[spin_10s_linear_infinite]"></div>
            <div className="relative bg-white p-4 shadow-xl rounded-2xl border border-gray-100">
              <img src={qrImageSrc} alt="Patient Emergency QR Code" className="w-48 h-48 object-contain" />
              <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-medical-500 opacity-20" />
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-1">Jane Doe</h2>
          <div className="flex items-center gap-2 text-medical-600 font-mono bg-medical-50 px-3 py-1 rounded-md text-sm mb-4">
            <Fingerprint className="h-4 w-4" />
            Patient ID: <strong>MT-78192-A</strong>
          </div>
          
          <div className="bg-yellow-50 text-yellow-800 border-l-4 border-yellow-400 p-3 text-xs rounded-r-md max-w-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="font-medium">Confidential: Scanning grants limited-time access to allergies, blood type, and emergency contacts only.</p>
          </div>
        </div>
        
        <div className="bg-gray-50 p-6 flex flex-col items-center">
          <button 
            onClick={handleShare}
            className="btn-primary w-full flex justify-center gap-2 shadow-sm text-lg"
          >
            <Share2 className="h-5 w-5" />
            {isCopied ? 'ID Copied!' : 'Share Access Link'}
          </button>
          <p className="text-xs text-center text-gray-400 mt-4">Generate a new QR code any time to revoke prior access links.</p>
        </div>
      </div>
    </div>
  );
};

export default QRPage;
