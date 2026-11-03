import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { 
  Terminal, 
  FolderLock, 
  PlusSquare, 
  LayoutDashboard, 
  Search, 
  Bold, 
  Italic, 
  Code, 
  List, 
  Save,
  Trash2,
  X,
  Eye,
  Edit
} from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ctf-portfolio-app';

const CATEGORY_COLORS = {
  pwn: "text-red-400 border-red-400/30 bg-red-400/10",
  web: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  crypto: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  forensics: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  rev: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  osint: "text-teal-400 border-teal-400/30 bg-teal-400/10"
};

const DIFFICULTY_COLORS = {
  Textbook: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  Easy: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  Medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  Hard: "text-rose-400 border-rose-400/30 bg-rose-400/10"
};

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'editor', 'view'
  const [writeups, setWriteups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Editor State
  const [currentId, setCurrentId] = useState(null);
  const [formData, setFormData] = useState({
    ctf: '',
    challenge: '',
    category: 'web',
    difficulty: 'Easy',
    summary: ''
  });
  const editorRef = useRef(null);

  // View State
  const [viewingWriteup, setViewingWriteup] = useState(null);

  // Auth Effect
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        showNotification("Authentication failed.", "error");
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data Fetching Effect
  useEffect(() => {
    if (!user) return;

    const writeupsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'writeups');
    const unsubscribe = onSnapshot(writeupsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory (newest first)
      data.sort((a, b) => b.createdAt - a.createdAt);
      setWriteups(data);
    }, (error) => {
      console.error("Firestore Error:", error);
      showNotification("Failed to load data.", "error");
    });

    return () => unsubscribe();
  }, [user]);

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const resetEditor = () => {
    setCurrentId(null);
    setFormData({ ctf: '', challenge: '', category: 'web', difficulty: 'Easy', summary: '' });
    if (editorRef.current) {
      editorRef.current.innerHTML = '<p class="text-slate-500 italic mb-4">/* Begin your write-up here... */</p>';
    }
  };

  const handleCreateNew = () => {
    resetEditor();
    setCurrentView('editor');
  };

  const handleEdit = (writeup) => {
    setCurrentId(writeup.id);
    setFormData({
      ctf: writeup.ctf,
      challenge: writeup.challenge,
      category: writeup.category,
      difficulty: writeup.difficulty,
      summary: writeup.summary || ''
    });
    setCurrentView('editor');
    // We need to set the innerHTML after a short delay to ensure the ref is mounted
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = writeup.content;
      }
    }, 50);
  };

  const handleView = (writeup) => {
    setViewingWriteup(writeup);
    setCurrentView('view');
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.ctf || !formData.challenge) {
      showNotification("CTF Name and Challenge Name are required.", "error");
      return;
    }

    setIsSaving(true);
    const content = editorRef.current ? editorRef.current.innerHTML : '';
    
    // Auto-generate a simple summary if none provided by taking first 100 text characters
    let summary = formData.summary;
    if (!summary && editorRef.current) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      const text = tempDiv.textContent || tempDiv.innerText || "";
      summary = text.substring(0, 120).replace(/\/\* Begin your write-up here\.\.\. \*\//g, '').trim() + "...";
    }

    const writeupData = {
      ...formData,
      summary,
      content,
      updatedAt: Date.now()
    };

    try {
      if (currentId) {
        // Update existing
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'writeups', currentId);
        await updateDoc(docRef, writeupData);
        showNotification("Case File updated successfully.");
      } else {
        // Create new
        writeupData.createdAt = Date.now();
        const writeupsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'writeups');
        await addDoc(writeupsRef, writeupData);
        showNotification("New Case File saved successfully.");
      }
      setCurrentView('dashboard');
    } catch (err) {
      console.error("Save error:", err);
      showNotification("Failed to save Case File.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!user) return;
    // Note: Alert/Confirm is forbidden by rules, implementing a direct delete for simplicity, 
    // in a real app we'd use a custom modal here.
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'writeups', id));
      showNotification("Case File deleted.");
      if (currentView === 'view' && viewingWriteup?.id === id) {
        setCurrentView('dashboard');
      }
    } catch (err) {
      console.error("Delete error:", err);
      showNotification("Failed to delete.", "error");
    }
  };

  // Basic WYSIWYG commands
  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  const formatCodeBlock = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    // Simple block wrapping for demonstration
    const range = selection.getRangeAt(0);
    const codeBlock = document.createElement('div');
    codeBlock.className = "bg-black/50 border border-slate-800 rounded-md p-4 my-4 text-emerald-500 font-mono text-sm overflow-x-auto whitespace-pre-wrap";
    codeBlock.textContent = selection.toString() || "/* insert code here */";
    
    range.deleteContents();
    range.insertNode(codeBlock);
    
    // Add a paragraph after so user can continue typing
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    codeBlock.parentNode.insertBefore(p, codeBlock.nextSibling);
  };

  const filteredWriteups = writeups.filter(w => 
    w.ctf.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.challenge.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex overflow-hidden selection:bg-emerald-500/30">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-md shadow-lg border font-mono text-sm transition-all animate-in slide-in-from-top-4 ${
          notification.type === 'error' ? 'bg-rose-950/80 border-rose-500/50 text-rose-200' : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
        }`}>
          {notification.msg}
        </div>
      )}

      {/* Sidebar Navigation */}
      <nav className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col p-4 space-y-6 flex-shrink-0">
        <div className="flex items-center space-x-3 text-emerald-400 mb-4 px-2">
          <Terminal size={28} />
          <h1 className="text-xl font-bold tracking-wider uppercase">0xWriteups</h1>
        </div>
        
        <div className="space-y-2 flex-grow">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${currentView === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          
          <button 
            onClick={handleCreateNew}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${currentView === 'editor' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            <PlusSquare size={20} />
            <span className="font-medium">New Case File</span>
          </button>
          
          <div className="pt-6 pb-2 px-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Categories Filter</p>
          </div>
          {Object.keys(CATEGORY_COLORS).map(cat => (
             <div 
                key={cat} 
                onClick={() => { setSearchTerm(cat); setCurrentView('dashboard'); }}
                className="flex items-center space-x-3 px-4 py-2 text-sm text-slate-400 hover:text-emerald-400 cursor-pointer transition-colors"
              >
                <FolderLock size={16} />
                <span className="uppercase">{cat}</span>
             </div>
          ))}
        </div>
        
        <div className="mt-auto px-4 text-xs text-slate-600 font-mono break-all">
          <span className="text-slate-500">System:</span> ONLINE<br/>
          <span className="text-slate-500">User:</span> {user?.uid.substring(0, 8) || 'connecting...'}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 p-8">
        
        {/* VIEW: DASHBOARD */}
        {currentView === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Case Files</h2>
                <p className="text-slate-400">Manage and review your CTF exploitation write-ups.</p>
              </div>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Grep logs..." 
                  className="bg-slate-900 border border-slate-700 rounded-md py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-64 transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {writeups.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                <Terminal size={48} className="mx-auto text-slate-700 mb-4" />
                <h3 className="text-xl text-slate-400 font-medium mb-2">No Case Files Found</h3>
                <p className="text-slate-500 mb-6">Initialize your first write-up to start tracking your progress.</p>
                <button 
                  onClick={handleCreateNew}
                  className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 px-6 py-2 rounded-md transition-colors"
                >
                  Create New File
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredWriteups.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => handleView(item)}
                    className="group bg-slate-900/80 border border-slate-800 p-6 rounded-xl hover:border-emerald-500/50 hover:bg-slate-900 transition-all cursor-pointer relative overflow-hidden flex flex-col"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-800 group-hover:bg-emerald-500 transition-colors"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase border ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.pwn}`}>
                          {item.category}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase border ${DIFFICULTY_COLORS[item.difficulty] || DIFFICULTY_COLORS.Easy}`}>
                          {item.difficulty}
                        </span>
                      </div>
                      <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="text-slate-400 hover:text-emerald-400 p-1"><Edit size={16}/></button>
                        <button onClick={(e) => handleDelete(e, item.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">{item.challenge}</h3>
                    <p className="text-sm text-slate-500 mb-4 font-mono">{item.ctf} // {new Date(item.createdAt).toLocaleDateString()}</p>
                    
                    <p className="text-slate-400 text-sm line-clamp-3 mb-4 flex-grow">{item.summary}</p>

                    <div className="flex items-center text-xs text-emerald-500/70 font-mono mt-auto">
                      <Eye size={14} className="mr-1" /> View Full Report
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: READ ONLY */}
        {currentView === 'view' && viewingWriteup && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
             <div className="flex justify-between items-center mb-6">
                <button onClick={() => setCurrentView('dashboard')} className="text-slate-400 hover:text-emerald-400 font-mono text-sm flex items-center">
                  ← Return to Dashboard
                </button>
                <div className="flex space-x-3">
                  <button onClick={() => handleEdit(viewingWriteup)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-4 rounded text-sm flex items-center transition-colors">
                    <Edit size={14} className="mr-2"/> Edit
                  </button>
                </div>
             </div>

             <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-8 shadow-xl">
                <div className="flex space-x-3 mb-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-mono uppercase border ${CATEGORY_COLORS[viewingWriteup.category] || CATEGORY_COLORS.pwn}`}>
                    {viewingWriteup.category}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-mono uppercase border ${DIFFICULTY_COLORS[viewingWriteup.difficulty] || DIFFICULTY_COLORS.Easy}`}>
                    {viewingWriteup.difficulty}
                  </span>
                </div>
                
                <h1 className="text-4xl font-bold text-white mb-2">{viewingWriteup.challenge}</h1>
                <p className="text-emerald-500/80 font-mono text-sm mb-10 pb-6 border-b border-slate-800">
                  Target: {viewingWriteup.ctf} | Logged: {new Date(viewingWriteup.createdAt).toLocaleString()}
                </p>

                <div 
                  className="prose prose-invert prose-emerald max-w-none font-sans text-slate-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: viewingWriteup.content }}
                />
             </div>
          </div>
        )}

        {/* VIEW: EDITOR */}
        {currentView === 'editor' && (
          <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
             <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">{currentId ? 'Edit Case File' : 'Initialize New Writeup'}</h2>
                <p className="text-slate-400">Log metadata and document the exploitation process.</p>
              </div>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2 px-6 rounded-md flex items-center space-x-2 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <Save size={18} />
                <span>{isSaving ? 'Saving...' : 'Save Case'}</span>
              </button>
            </div>

            {/* Metadata Card */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl shadow-lg">
              <h3 className="text-sm font-mono text-emerald-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2">Target Metadata</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">CTF Name *</label>
                  <input 
                    type="text" 
                    value={formData.ctf}
                    onChange={(e) => setFormData({...formData, ctf: e.target.value})}
                    placeholder="e.g. DEF CON Quals" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-md py-2.5 px-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">Challenge Name *</label>
                  <input 
                    type="text" 
                    value={formData.challenge}
                    onChange={(e) => setFormData({...formData, challenge: e.target.value})}
                    placeholder="e.g. Buffer Overflow 1" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-md py-2.5 px-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">Category</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md py-2.5 px-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="pwn">Pwn (Binary Exploitation)</option>
                    <option value="web">Web Exploitation</option>
                    <option value="crypto">Cryptography</option>
                    <option value="rev">Reverse Engineering</option>
                    <option value="forensics">Forensics</option>
                    <option value="osint">OSINT</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">Difficulty</label>
                  <select 
                    value={formData.difficulty}
                    onChange={(e) => setFormData({...formData, difficulty: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md py-2.5 px-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Textbook">Textbook</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-400">Short Summary (Optional)</label>
                  <input 
                    type="text" 
                    value={formData.summary}
                    onChange={(e) => setFormData({...formData, summary: e.target.value})}
                    placeholder="Brief description for the dashboard..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-md py-2.5 px-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                  />
                </div>

              </div>
            </div>

            {/* Custom Rich Text Editor Setup */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg flex flex-col min-h-[500px]">
              
              {/* Editor Toolbar */}
              <div className="border-b border-slate-800 bg-slate-900 p-2 flex items-center space-x-1 flex-wrap rounded-t-xl sticky top-0 z-10">
                <button onClick={() => execCommand('formatBlock', 'H1')} className="px-3 py-1.5 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded font-bold">H1</button>
                <button onClick={() => execCommand('formatBlock', 'H2')} className="px-3 py-1.5 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded font-bold">H2</button>
                <button onClick={() => execCommand('formatBlock', 'P')} className="px-3 py-1.5 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded">P</button>
                
                <div className="w-px h-6 bg-slate-700 mx-2"></div>
                
                <button onClick={() => execCommand('bold')} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors" title="Bold"><Bold size={16} /></button>
                <button onClick={() => execCommand('italic')} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors" title="Italic"><Italic size={16} /></button>
                <button onClick={() => execCommand('insertUnorderedList')} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors" title="Bullet List"><List size={16} /></button>
                
                <div className="w-px h-6 bg-slate-700 mx-2"></div>
                
                <button onClick={formatCodeBlock} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors flex items-center space-x-1">
                  <Code size={16} /> <span className="text-xs font-medium">Code Block</span>
                </button>

                <div className="ml-auto flex items-center px-4">
                   <span className="text-[10px] text-slate-500 uppercase tracking-wider">Note: Images can be copy-pasted directly into the editor.</span>
                </div>
              </div>
              
              {/* Editor Area */}
              <div 
                ref={editorRef}
                className="p-6 flex-grow bg-slate-950 text-slate-200 outline-none overflow-y-auto prose prose-invert prose-emerald max-w-none font-sans text-sm leading-relaxed"
                contentEditable="true"
                suppressContentEditableWarning={true}
                style={{ minHeight: '400px' }}
                onKeyDown={(e) => {
                  // Handle tab for indentation instead of leaving editor
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    document.execCommand('insertHTML', false, '&#009');
                  }
                }}
              >
                {!currentId && <p className="text-slate-500 italic mb-4">/* Begin your write-up here... */</p>}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}