import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, File, AlertCircle, CheckCircle, X, Lock } from 'lucide-react';
import { refreshVaultStatus, uploadRecord } from '../services/api';
import Button from '../components/Button';

const UploadRecord = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({ title: '', description: '', type: 'Lab Result' });
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const getUserId = () => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch { return {}; }
  };
  const user = getUserId();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setStatus({ type: 'error', message: 'Please select a file to upload' });
      return;
    }

    if (!formData.title) {
      setStatus({ type: 'error', message: 'Title is required' });
      return;
    }

    setIsUploading(true);
    setStatus({ type: '', message: '' });

    const uploadData = new FormData();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    uploadData.append('file', file);
    uploadData.append('patientId', user.id || '');
    uploadData.append('title', formData.title);
    uploadData.append('description', formData.description);
    uploadData.append('type', formData.type);

    try {
      await uploadRecord(uploadData);
      
      // Refresh vault status explicitly via API call as requested
      try {
        await refreshVaultStatus();
      } catch (e) {
        console.error("Failed to refresh vault status:", e);
      }
      
      setStatus({ type: 'success', message: 'Record uploaded and securely encrypted!' });
      setTimeout(() => navigate('/records'), 2000);
    } catch (err) {
      const message = err.response?.status === 403 
        ? (err.response?.data?.message || "Vault access has been revoked.")
        : (err.response?.data?.message || err.response?.data?.error || 'Upload failed. Please try again.');
      setStatus({ type: 'error', message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full animate-fade-in relative z-10">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center sm:justify-start gap-4">
          <div className="p-3 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl shadow-glow">
            <UploadCloud className="h-7 w-7 text-white" />
          </div>
          Upload Record
        </h1>
        <p className="text-slate-500 mt-4 text-lg max-w-xl mx-auto sm:mx-0">
          Securely digitize and store a new medical document to your encrypted vault.
        </p>
      </div>

      <div className="glass-panel p-8 sm:p-10">
        {user.vaultAccess === false ? (
          <div className="text-center py-10 flex flex-col items-center justify-center min-h-[300px]">
            <div className="mx-auto w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-100">
              <Lock className="h-12 w-12 text-red-400" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Upload Disabled</h2>
            <p className="text-xl text-slate-500 max-w-lg mb-8 leading-relaxed">
              Your access to upload new records has been revoked or is disabled.
            </p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        ) : (
          <>
        {status.message && (
          <div className={`mb-8 p-4 flex gap-4 rounded-2xl border backdrop-blur-md animate-slide-up ${status.type === 'success' ? 'bg-green-50/80 border-green-200' : 'bg-red-50/80 border-red-200'}`}>
            {status.type === 'success' ? <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" /> : <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />}
            <div>
              <h3 className={`text-base font-bold ${status.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {status.type === 'success' ? 'Upload Complete' : 'Upload Failed'}
              </h3>
              <p className={`text-sm mt-1 font-medium ${status.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{status.message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Document Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. MRI Scan - Lower Back"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Document Type</label>
                <div className="relative">
                  <select
                    className="input-field appearance-none"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="Lab Result">Lab Result</option>
                    <option value="Scan">Scan (X-Ray, MRI)</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Vaccination">Vaccination</option>
                    <option value="Other">Other Document</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Notes / Description</label>
              <textarea
                className="input-field min-h-[120px] resize-y"
                placeholder="Add any relevant information for your doctor..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              ></textarea>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3 ml-1">Upload File <span className="text-red-500">*</span></label>
            
            {!file ? (
              <div 
                className={`w-full flex justify-center px-6 py-12 border-2 border-dashed rounded-3xl transition-all duration-300 cursor-pointer
                  ${isDragActive ? 'border-brand-500 bg-brand-50/50 scale-[1.02]' : 'border-slate-300/80 bg-slate-50/30 hover:border-brand-400 hover:bg-brand-50/30'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="space-y-4 text-center">
                  <div className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm
                    ${isDragActive ? 'bg-brand-500 text-white shadow-glow scale-110' : 'bg-white text-brand-500'}`}>
                    <UploadCloud className="h-10 w-10" />
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="text-lg font-bold text-slate-800">
                      Click to upload <span className="text-slate-500 font-medium">or drag and drop</span>
                    </span>
                    <input 
                      ref={fileInputRef} 
                      type="file" 
                      className="sr-only" 
                      onChange={handleChange} 
                      accept=".pdf,.png,.jpg,.jpeg,.dcm"
                    />
                  </div>
                  <p className="text-sm font-medium text-slate-400">
                    PDF, PNG, JPG, or DICOM up to 20MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-5 border border-brand-200 bg-brand-50/80 backdrop-blur-sm rounded-2xl flex items-center justify-between shadow-sm animate-scale-in">
                <div className="flex items-center gap-5 border-r border-brand-200/60 pr-5 flex-1 overflow-hidden">
                  <div className="p-3 bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-brand-600">
                    <File className="h-8 w-8" />
                  </div>
                  <div className="truncate">
                    <p className="text-base font-bold text-slate-900 truncate mb-0.5">{file.name}</p>
                    <p className="text-sm font-medium text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="ml-5 p-2.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all duration-200 focus:outline-none shadow-sm bg-white/50"
                  title="Remove file"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-8 border-t border-slate-200/60 flex flex-col sm:flex-row justify-end gap-4">
            <Button variant="ghost" type="button" onClick={() => navigate(-1)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isUploading || !file || !formData.title}
              className={`w-full sm:w-auto ${(!file || !formData.title || isUploading) ? "opacity-70" : ""}`}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 border-r border-white/20 pr-2" />
                  Commit to Vault
                </span>
              )}
            </Button>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
};

export default UploadRecord;
