import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileUp, List, Clock, Activity, FileText, ChevronRight, Eye, Trash2, Lock } from 'lucide-react';
import Button from '../components/Button';
import { deleteRecordFile, getRecentRecords, getVaultStatus, refreshVaultStatus } from '../services/api';

const formatStorage = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) {
      return '0 MB';
    }
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return '0 MB';
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: 'User' });
  const [recentRecords, setRecentRecords] = useState([]);
  const [vaultStatus, setVaultStatus] = useState({ totalRecords: 0, storageUsed: '0 MB', lastUpdated: null, status: 'active' });
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingVault, setLoadingVault] = useState(true);

  const getUserId = () => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return u.id || u.userId || '';
    } catch { return ''; }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch {}
    }

    // Fetch recent records
    const fetchRecent = async () => {
      try {
        setLoadingRecent(true);
        const data = await getRecentRecords(getUserId() || null);
        let list = [];
        
        if (Array.isArray(data)) {
          list = data;
        } else if (data?.records && Array.isArray(data.records)) {
          list = data.records;
        } else if (data?.recentRecords && Array.isArray(data.recentRecords)) {
          list = data.recentRecords; 
        } else if (typeof data === 'object' && data !== null) {
          // If it's a single object that isn't wrapped in an array but has record-like fields
          if (data.id || data._id || data.title || data.name) {
             list = [data];
          }
        }
        
        // Ensure no objects-as-children reach the render method by sanitizing the list
        const sanitizedList = list.map(record => {
           if (typeof record !== 'object' || record === null) return {};
           return {
             ...record,
             // Ensure strings for renderable fields, guarding against unexpected nested objects
             title: typeof record.title === 'string' ? record.title : 
                    (typeof record.name === 'string' ? record.name : 'Unknown Record'),
             type: typeof record.type === 'string' ? record.type : 'Document',
             date: typeof record.date === 'string' ? record.date : 
                   (typeof record.createdAt === 'string' ? new Date(record.createdAt).toLocaleDateString() : 'Today'),
             // Keep IDs intact
             id: record.id || record._id || Math.random().toString(36).substr(2, 9)
           };
        });

        setRecentRecords(sanitizedList);
      } catch (err) {
        console.error('Error fetching recent records:', err);
        setRecentRecords([]);
      } finally {
        setLoadingRecent(false);
      }
    };

    // Fetch vault status
    const fetchVault = async () => {
      try {
        setLoadingVault(true);
        const data = await getVaultStatus(getUserId() || null);
        
        let recordsCount = 0;
        let storage = '0 MB';
        let activity = null;
        let vaultState = 'active';

        if (data) {
          // If the stats are nested inside an object property
          let statsObj = data;
          if (data.data) {
            statsObj = data.data;
          } else if (data.vaultStatus) {
            statsObj = data.vaultStatus;
          } else if (data.status && typeof data.status === 'object') {
            statsObj = data.status;
          }

          recordsCount = statsObj.totalRecords ?? statsObj.count ?? data.totalRecords ?? data.count ?? 0;
          storage = statsObj.totalFileSize ?? statsObj.storageUsed ?? statsObj.storage ?? data.totalFileSize ?? data.storageUsed ?? '0 MB';
          activity = statsObj.lastAddedAt ?? statsObj.lastUpdated ?? statsObj.lastActivity ?? data.lastAddedAt ?? null;
          vaultState = statsObj.vaultState ?? data.vaultState ?? 'active';

          // Failsafe for object coercions
          if (typeof recordsCount === 'object') recordsCount = 0;
          storage = formatStorage(storage);
          if (typeof storage !== 'string') storage = String(storage || '0 MB');
          if (storage === '[object Object]') storage = '0 MB';
          if (typeof activity === 'object' && activity !== null) activity = null;
          if (typeof vaultState !== 'string') vaultState = String(vaultState || 'active');
          if (vaultState === '[object Object]') vaultState = 'active';
        }

        setVaultStatus({
          totalRecords: recordsCount,
          storageUsed: storage,
          lastUpdated: activity,
          status: vaultState,
        });
      } catch (err) {
        console.error('Error fetching vault status:', err);
      } finally {
        setLoadingVault(false);
      }
    };

    fetchRecent();
    fetchVault();
  }, []);

  const handleDelete = async (record) => {
    if (!record.fileUrl) {
      alert("Cannot delete this record as it lacks a file reference.");
      return;
    }
    const password = prompt("Please enter your login password to confirm deletion of this record:");
    if (!password) return;

    try {
      await deleteRecordFile(record.fileUrl, password);
      const refreshedStatus = await refreshVaultStatus();
      setRecentRecords((prev) => prev.filter((entry) => (entry.id || entry._id) !== (record.id || record._id)));
      setVaultStatus((prev) => {
        const statsObj = refreshedStatus?.status || refreshedStatus?.storage || refreshedStatus || {};
        return {
          ...prev,
          totalRecords: statsObj.totalRecords ?? prev.totalRecords,
          storageUsed: formatStorage(statsObj.totalFileSize ?? statsObj.storageUsed ?? prev.storageUsed),
          lastUpdated: statsObj.lastAddedAt ?? prev.lastUpdated,
        };
      });
    } catch (error) {
      console.error("Error deleting record:", error);
      alert(error.response?.data?.message || error.message || "Failed to delete record");
    }
  };

  return (
    <div className="page-shell">
      <div className="mb-10 text-center sm:text-left mt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Welcome back, <br className="sm:hidden" /><span className="text-gradient">{user.name}</span>
        </h1>
        <p className="text-slate-500 mt-4 text-lg sm:text-xl font-medium max-w-2xl">
          Everything looks great. Here is the latest overview of your secure medical vault.
        </p>
      </div>

      {user.vaultAccess === false ? (
        <div className="glass-panel p-10 text-center mb-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="mx-auto w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-100">
            <Lock className="h-12 w-12 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Vault Access Disabled</h2>
          <p className="text-xl text-slate-500 max-w-lg mb-8 leading-relaxed">
            Your access to the secure medical vault has been revoked or is currently disabled. Please contact your administrator if you believe this is an error.
          </p>
          <Button variant="outline" onClick={() => navigate('/login')}>
            Return to Login
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {/* Primary Action Card: Upload */}
        <Link to="/upload" className="group lg:col-span-2">
          <div className="h-full glass-panel bg-gradient-to-br from-brand-500/90 to-accent-600/90 text-white p-8 hover:scale-[1.02] transition-transform duration-300 shadow-glow">
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 transition-opacity duration-300 group-hover:scale-110 transform">
              <FileUp className="w-32 h-32" />
            </div>
            
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="inline-flex p-3 bg-white/20 rounded-2xl backdrop-blur-md mb-6">
                  <FileUp className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-3 font-sans">Upload Record</h2>
                <p className="text-brand-50 text-base max-w-sm mb-8 leading-relaxed">
                  Securely add new lab results, scans, or prescriptions to your encrypted vault.
                </p>
              </div>
              <div className="inline-flex items-center text-sm font-semibold text-white bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-xl w-fit group-hover:bg-white/30 transition-colors">
                Start Upload <ChevronRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
        
        {/* Vault Status Widget - Real Data */}
        <div className="glass-panel p-8 flex flex-col justify-between group hover:border-brand-300 transition-colors duration-300">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-green-50 rounded-xl">
                <Activity className="h-6 w-6 text-green-500 animate-pulse-glow" />
              </div>
              <span className="text-slate-700 font-bold text-lg">Vault Status</span>
            </div>
            
            {loadingVault ? (
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                <span className="text-sm text-slate-500">Loading...</span>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-5xl font-extrabold text-slate-900 tracking-tighter">{vaultStatus.totalRecords}</span>
                  <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">records</span>
                </div>
                
                <p className="text-sm text-slate-500 leading-relaxed">
                  {vaultStatus.storageUsed !== '0 MB' 
                    ? `${vaultStatus.storageUsed} used - Fully encrypted and securely verified.`
                    : 'Fully encrypted and securely verified on the network.'}
                </p>
              </>
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-200/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-700">Storage</span>
              <span className="text-sm font-bold text-brand-600 capitalize">{vaultStatus.status}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div className="bg-gradient-to-r from-brand-400 to-green-400 h-full rounded-full w-full relative">
                 <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action: View Records */}
        <Link to="/records" className="group lg:col-span-3">
          <div className="glass-panel hover:border-accent-300 transition-all duration-300 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 hover:shadow-soft group-hover:-translate-y-1">
            <div className="flex items-center gap-6">
               <div className="p-4 bg-accent-50 rounded-2xl text-accent-600 group-hover:bg-accent-100 group-hover:scale-110 transition-all duration-300">
                 <List className="h-8 w-8" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-slate-900 group-hover:text-accent-600 transition-colors mb-1">Browse Medical History</h2>
                 <p className="text-slate-500 text-sm">Access your complete timeline of medical history and documents.</p>
               </div>
            </div>
            <div className="flex items-center text-sm font-bold text-accent-600 bg-accent-50 px-5 py-2.5 rounded-xl group-hover:bg-accent-100 transition-colors w-full sm:w-auto justify-center">
              View All <ChevronRight className="h-5 w-5 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity Section - Real Data */}
      <div className="glass-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
               <Clock className="h-6 w-6 text-slate-600" />
            </div>
            Recent Additions
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/records')}>
            View history
          </Button>
        </div>

        <div className="overflow-hidden">
          {loadingRecent ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : recentRecords.length > 0 ? (
            <ul className="divide-y divide-slate-100/50">
              {recentRecords.map((record) => (
                <li key={record.id || record._id} className="py-4 hover:bg-slate-50/50 -mx-4 px-4 sm:-mx-8 sm:px-8 transition-colors flex items-center justify-between group rounded-xl">
                  <div className="flex items-center gap-5">
                    <div className="p-3.5 bg-brand-50/80 border border-brand-100 text-brand-600 rounded-2xl shadow-sm group-hover:bg-brand-100 group-hover:scale-105 transition-all">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 mb-1">{record.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md">{record.type || 'Document'}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span>{record.date || (record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'Today')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {(record.previewUrl || record.fileUrl) && (
                      <button 
                        onClick={() => window.open(record.previewUrl || record.fileUrl, '_blank')}
                        className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-50 text-accent-700 hover:bg-accent-100 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                      </button>
                    )}
                    {(record.status === 'verified') && (
                      <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                        Verified
                      </span>
                    )}
                    {record.fileUrl && (
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(record); }}
                        className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                      </button>
                    )}
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10">
              <p className="text-slate-500 font-medium">No recent records yet. Upload your first document to get started.</p>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default Dashboard;

