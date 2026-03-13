import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Search, Download, Eye, Calendar, Tag, ShieldCheck, Trash2, Lock, Edit } from 'lucide-react';
import { deleteRecordFile, getRecords, refreshVaultStatus, updateRecordFile } from '../services/api';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';

const Records = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch { return {}; }
  };
  const user = getUser();

  const fetchRecords = useCallback(async (search = '') => {
    try {
      setLoading(true);
      const data = await getRecords(null, search);
      let list = [];
      
      if (Array.isArray(data)) {
        list = data;
      } else if (data?.records && Array.isArray(data.records)) {
        list = data.records;
      } else if (typeof data === 'object' && data !== null) {
        if (data.id || data._id || data.title || data.name) {
           list = [data];
        }
      }

      // Ensure no objects-as-children reach the render method by sanitizing the list
      const sanitizedList = list.map(record => {
         if (typeof record !== 'object' || record === null) return {};
         return {
           ...record,
           title: typeof record.title === 'string' ? record.title : 
                  (typeof record.name === 'string' ? record.name : 'Unknown Record'),
           description: typeof record.description === 'string' ? record.description : 'No description provided.',
           type: typeof record.type === 'string' ? record.type : 'Document',
           date: typeof record.date === 'string' ? record.date : 
                 (typeof record.createdAt === 'string' ? new Date(record.createdAt).toLocaleDateString() : 'Today'),
           id: record.id || record._id || Math.random().toString(36).substr(2, 9)
         };
      });

      setRecords(sanitizedList);
    } catch (error) {
      console.error("Error fetching records:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Debounced server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchRecords]);

  const handlePreview = (record) => {
    if (record.previewUrl) {
      window.open(record.previewUrl, '_blank', 'noopener,noreferrer');
    } else if (record.fileUrl) {
      window.open(record.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = (record) => {
    if (record.downloadUrl || record.fileUrl) {
      const link = document.createElement('a');
      link.href = record.downloadUrl || record.fileUrl;
      link.download = record.title || 'document';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async (record) => {
    if (!record.fileUrl) {
      alert("Cannot delete this record as it lacks a file reference.");
      return;
    }
    const password = prompt("Please enter your login password to confirm deletion of this record:");
    if (!password) return;

    try {
      setLoading(true);
      await deleteRecordFile(record.fileUrl, password);
      await refreshVaultStatus();
      fetchRecords(searchTerm);
    } catch (error) {
      console.error("Error deleting record:", error);
      const message = error.response?.status === 403 
        ? error.response.data?.message || "Vault access has been revoked."
        : error.response?.data?.message || "Failed to delete record";
      alert(message);
      setLoading(false);
    }
  };

  const handleEdit = async (record) => {
    if (!record.fileUrl) {
      alert("Cannot edit this record as it lacks a file reference.");
      return;
    }
    const password = prompt("Please enter your login password to confirm editing this record:");
    if (!password) return;

    const newTitle = prompt("Enter new title (leave blank to keep current):", record.title);
    if (newTitle === null) return; // User cancelled
    
    const newDescription = prompt("Enter new notes (leave blank to keep current):", record.description || '');
    if (newDescription === null) return; // User cancelled

    try {
      setLoading(true);
      await updateRecordFile(record.fileUrl, {
        password,
        title: newTitle || record.title,
        description: newDescription || record.description
      });
      
      fetchRecords(searchTerm);
    } catch (error) {
      console.error("Error editing record:", error);
      const message = error.response?.status === 403 
        ? error.response.data?.message || "Vault access has been revoked."
        : error.response?.data?.message || "Failed to edit record";
      alert(message);
      setLoading(false);
    }
  };

  const getTypeStyle = (type) => {
    switch(type?.toLowerCase()) {
      case 'lab result': return 'bg-accent-50/50 text-accent-700 border-accent-200/50 shadow-sm';
      case 'scan': return 'bg-purple-50/50 text-purple-700 border-purple-200/50 shadow-sm';
      case 'prescription': return 'bg-brand-50/50 text-brand-700 border-brand-200/50 shadow-sm';
      case 'vaccination': return 'bg-orange-50/50 text-orange-700 border-orange-200/50 shadow-sm';
      default: return 'bg-slate-50/50 text-slate-700 border-slate-200/50 shadow-sm';
    }
  };

  return (
    <div className="page-shell relative z-10 hidden-scrollbar">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Medical History
            <div className="p-2 bg-brand-50 rounded-xl">
              <ShieldCheck className="h-6 w-6 text-brand-500 animate-pulse-glow" />
            </div>
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Securely encrypted and stored records on the network.</p>
        </div>
        
        <div className="w-full md:w-auto relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-500 text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            className="input-field pl-12 md:min-w-[320px] shadow-sm bg-white/60 backdrop-blur-md"
            placeholder="Search records by title, type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {user.vaultAccess === false ? (
        <div className="glass-panel p-10 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="mx-auto w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-100">
            <Lock className="h-12 w-12 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Vault Access Disabled</h2>
          <p className="text-xl text-slate-500 max-w-lg mb-8 leading-relaxed">
            Your access to view and manage medical records has been revoked or is disabled.
          </p>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      ) : (
      <>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {records.length > 0 ? (
            records.map((record) => (
              <div key={record.id || record._id} className="glass-panel flex flex-col h-full group hover:-translate-y-2 hover:shadow-glow transition-all duration-300 p-6">
                <div className="flex justify-between items-start mb-5">
                  <div className="p-3.5 bg-brand-50 text-brand-600 rounded-2xl group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300 shadow-sm">
                    <FileText className="h-6 w-6" />
                  </div>
                  <span className={`px-3 py-1.5 inline-flex text-xs font-bold rounded-full border backdrop-blur-sm ${getTypeStyle(record.type)}`}>
                    {record.type || 'Document'}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-1">{record.title}</h3>
                <p className="text-sm text-slate-500 mb-6 line-clamp-2 flex-1 leading-relaxed">{record.description}</p>
                
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-6 pb-5 border-b border-slate-200/50">
                  <span className="flex items-center gap-1.5 bg-slate-100/50 px-2.5 py-1 rounded-md">
                    <Calendar className="h-4 w-4 text-slate-400" /> 
                    {record.date || (record.createdAt ? new Date(record.createdAt).toLocaleDateString() : new Date().toLocaleDateString())}
                  </span>
                  <span className="flex items-center gap-1.5 text-green-600 bg-green-50/50 px-2.5 py-1 rounded-md">
                    <Tag className="h-4 w-4" /> {record.status === 'verified' ? 'Verified' : 'Stored'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-auto text-xs font-bold">
                  <button 
                    onClick={() => handlePreview(record)}
                    disabled={!record.previewUrl && !record.fileUrl}
                    title="Preview"
                    className="flex items-center justify-center gap-1.5 py-2 px-1 bg-accent-50 text-accent-700 hover:bg-accent-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                  <button 
                    onClick={() => handleDownload(record)}
                    disabled={!record.downloadUrl && !record.fileUrl}
                    title="Download"
                    className="flex items-center justify-center gap-1.5 py-2 px-1 bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                  <button 
                    onClick={() => handleEdit(record)}
                    disabled={!record.fileUrl}
                    title="Edit"
                    className="flex items-center justify-center gap-1.5 py-2 px-1 bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Edit className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(record)}
                    disabled={!record.fileUrl}
                    title="Delete"
                    className="flex items-center justify-center gap-1.5 py-2 px-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-24 text-center glass-panel flex flex-col items-center justify-center">
              <div className="mx-auto w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
                <Search className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">No records found</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                {searchTerm 
                  ? `No documents found matching "${searchTerm}". Try different keywords.` 
                  : 'Your medical vault is empty. Upload your first record to get started.'}
              </p>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default Records;
