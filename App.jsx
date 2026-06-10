import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, FileText, BarChart3, Bell, LogOut, Plus, Search, Edit2, Trash2, X, Clock, CheckCircle, AlertTriangle, Flag, Eye, EyeOff, Download, Filter, Tag, Award, TrendingUp, Target, ArrowLeft, ArrowRight, ChevronRight, Database, Zap, Shield, BookMarked, Send, Star, Menu, Check, AlertCircle, Upload, RefreshCw, Settings, User, GraduationCap, BookCheck, ListChecks, Megaphone, PieChart, Activity } from 'lucide-react';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const cn = (...c) => c.filter(Boolean).join(' ');
const gc = g => g==='A'?'text-emerald-600':g==='B'?'text-teal-600':g==='C'?'text-amber-600':g==='D'?'text-orange-500':g==='E'?'text-orange-600':'text-red-600';
const gcBg = g => g==='A'?'bg-emerald-50 text-emerald-700 border-emerald-200':g==='B'?'bg-teal-50 text-teal-700 border-teal-200':g==='C'?'bg-amber-50 text-amber-700 border-amber-200':'bg-red-50 text-red-700 border-red-200';
const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const initials = name => name?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';

// ─── TOAST ────────────────────────────────────────────────────────────────────
let _setToasts = null;
const toast = {
  show:(msg,type='info',dur=3500)=>{ const id=Date.now()+Math.random(); _setToasts?.(p=>[...p,{id,msg,type}]); setTimeout(()=>_setToasts?.(p=>p.filter(t=>t.id!==id)),dur); },
  success:msg=>toast.show(msg,'success'), error:msg=>toast.show(msg,'error',4500), info:msg=>toast.show(msg,'info'), warning:msg=>toast.show(msg,'warning'),
};
function Toaster() {
  const [toasts,setToasts]=useState([]);
  useEffect(()=>{_setToasts=setToasts;},[]);
  const icons={success:<CheckCircle size={15}/>,error:<AlertCircle size={15}/>,info:<Bell size={15}/>,warning:<AlertTriangle size={15}/>};
  const styles={success:'bg-emerald-50 border-emerald-300 text-emerald-800',error:'bg-red-50 border-red-300 text-red-800',info:'bg-blue-50 border-blue-300 text-blue-800',warning:'bg-amber-50 border-amber-300 text-amber-800'};
  return <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">{toasts.map(t=><div key={t.id} className={cn('flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium max-w-xs animate-slide-in',styles[t.type])}>{icons[t.type]}{t.msg}</div>)}</div>;
}

// ─── API ──────────────────────────────────────────────────────────────────────
const apiFetch = async (method,path,data) => {
  const token = localStorage.getItem('gss_token');
  const res = await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:data?JSON.stringify(data):undefined});
  const json = await res.json();
  if(!res.ok){ const e=new Error(json.error||'Request failed'); e.data=json; throw e; }
  return json;
};
const api = { get:p=>apiFetch('GET',p), post:(p,d)=>apiFetch('POST',p,d), put:(p,d)=>apiFetch('PUT',p,d), delete:p=>apiFetch('DELETE',p) };

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
function AuthProvider({children}) {
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('gss_user'));}catch{return null;}});
  const login=async(email,password)=>{ const d=await api.post('/login',{email,password}); localStorage.setItem('gss_token',d.token); localStorage.setItem('gss_user',JSON.stringify(d.user)); setUser(d.user); return d.user; };
  const register=async(form)=>{ const d=await api.post('/register',form); localStorage.setItem('gss_token',d.token); localStorage.setItem('gss_user',JSON.stringify(d.user)); setUser(d.user); return d.user; };
  const logout=()=>{ localStorage.removeItem('gss_token'); localStorage.removeItem('gss_user'); setUser(null); };
  const refreshUser=async()=>{ try{ const d=await api.get('/me'); setUser(d); localStorage.setItem('gss_user',JSON.stringify(d)); }catch{} };
  return <AuthCtx.Provider value={{user,login,register,logout,refreshUser}}>{children}</AuthCtx.Provider>;
}
const useAuth=()=>useContext(AuthCtx);
function Guard({children,role:r}){ const {user}=useAuth(); if(!user) return <Navigate to="/login" replace/>; if(r&&user.role!==r) return <Navigate to={`/${user.role}`} replace/>; return children; }

// ─── CHART WIDGET ─────────────────────────────────────────────────────────────
function GChart({type,data,options={},height=220}) {
  const ref=useRef(null); const inst=useRef(null);
  useEffect(()=>{
    if(!ref.current||!window.Chart) return;
    inst.current?.destroy();
    inst.current=new window.Chart(ref.current,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{family:'Plus Jakarta Sans',size:12},color:'#6b7280',padding:16}}},scales:type==='pie'||type==='doughnut'?{}:{x:{grid:{color:'#f0f2ff'},ticks:{font:{family:'Plus Jakarta Sans',size:11},color:'#9ca3af'}},y:{grid:{color:'#f0f2ff'},ticks:{font:{family:'Plus Jakarta Sans',size:11},color:'#9ca3af'}}},animation:{duration:600},...options}});
    return ()=>inst.current?.destroy();
  },[JSON.stringify(data)]);
  return <div style={{height}}><canvas ref={ref}/></div>;
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Spinner({lg}) { return <span className={cn('spinner',lg&&'spinner-lg')}/>; }

function Modal({title,onClose,children,size='md'}) {
  const w={sm:'max-w-md',md:'max-w-lg',lg:'max-w-2xl',xl:'max-w-3xl'}[size]||'max-w-lg';
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={cn('bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto',w)} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-primary-950">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Badge({children,color='slate'}) {
  const c={slate:'bg-slate-100 text-slate-700',blue:'bg-blue-50 text-blue-700',green:'bg-emerald-50 text-emerald-700',amber:'bg-amber-50 text-amber-700',red:'bg-red-50 text-red-700',purple:'bg-purple-50 text-purple-700',indigo:'bg-indigo-50 text-indigo-700'}[color]||'bg-slate-100 text-slate-700';
  return <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',c)}>{children}</span>;
}

function StatusBadge({s}) {
  const m={draft:['slate','Draft'],published:['blue','Published'],active:['green','Active'],completed:['purple','Completed'],archived:['amber','Archived']};
  const [c,l]=m[s]||['slate',s];
  return <Badge color={c}>{l}</Badge>;
}

function StatCard({label,value,color,icon:Icon,sub}) {
  const bg={indigo:'from-indigo-500 to-indigo-600',emerald:'from-emerald-500 to-emerald-600',amber:'from-amber-500 to-amber-600',sky:'from-sky-500 to-sky-600',purple:'from-purple-500 to-purple-600',rose:'from-rose-500 to-rose-600'}[color]||'from-indigo-500 to-indigo-600';
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-100 flex items-start gap-4 hover:-translate-y-0.5 transition-transform">
      <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0',bg)}><Icon size={20}/></div>
      <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p><p className="text-2xl font-extrabold text-primary-950">{value}</p>{sub&&<p className="text-xs text-slate-400 mt-0.5">{sub}</p>}</div>
    </div>
  );
}

function Card({children,className,pad=true}) { return <div className={cn('bg-white rounded-2xl shadow-card border border-slate-100',pad&&'p-6',className)}>{children}</div>; }

function Btn({children,variant='primary',size='md',className,disabled,onClick,type='button',icon:Icon}) {
  const base='inline-flex items-center justify-center gap-2 font-semibold transition-all rounded-xl';
  const sz={sm:'px-3 py-1.5 text-sm',md:'px-4 py-2.5 text-sm',lg:'px-6 py-3 text-base'}[size];
  const v={primary:'bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md active:scale-95',ghost:'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100',danger:'bg-red-500 text-white hover:bg-red-600',success:'bg-emerald-500 text-white hover:bg-emerald-600',amber:'bg-amber-500 text-white hover:bg-amber-600',outline:'border border-primary-300 text-primary-700 hover:bg-primary-50'}[variant];
  return <button type={type} disabled={disabled} onClick={onClick} className={cn(base,sz,v,disabled&&'opacity-50 cursor-not-allowed',className)}>{Icon&&<Icon size={16}/>}{children}</button>;
}

function Input({label,icon:Icon,...props}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label&&<label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
      <div className="relative">
        {Icon&&<Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>}
        <input className={cn('w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all bg-white',Icon&&'pl-9')} {...props}/>
      </div>
    </div>
  );
}

function Select({label,...props}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label&&<label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
      <select className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all bg-white appearance-none" {...props}/>
    </div>
  );
}

function Table({headers,children,loading,empty='No data found.'}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full">
        <thead><tr className="bg-slate-50">{headers.map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {loading?<tr><td colSpan={headers.length} className="py-16 text-center"><Spinner lg/></td></tr>
          :children&&React.Children.count(children)>0?children
          :<tr><td colSpan={headers.length} className="py-16 text-center text-sm text-slate-400">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function DiffBadge({d}) {
  const m={easy:'bg-emerald-50 text-emerald-700',medium:'bg-amber-50 text-amber-700',hard:'bg-red-50 text-red-700'};
  return <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-bold capitalize',m[d]||m.medium)}>{d}</span>;
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
function Layout({children,nav}) {
  const {user,logout}=useAuth(); const loc=useLocation(); const navigate=useNavigate();
  const [open,setOpen]=useState(false); const [unread,setUnread]=useState(0);
  useEffect(()=>{ api.get('/notifications').then(r=>setUnread(r.unread_count)).catch(()=>{}); },[]);
  const doLogout=()=>{ logout(); navigate('/'); toast.success('Signed out successfully'); };
  const ini=initials(user?.full_name);
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Overlay */}
      {open&&<div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={()=>setOpen(false)}/>}
      {/* Sidebar */}
      <aside className={cn('fixed top-0 left-0 bottom-0 w-64 bg-primary-950 flex flex-col z-50 shadow-sidebar transition-transform duration-300',open?'translate-x-0':'-translate-x-full lg:translate-x-0')}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-amber-400 flex items-center justify-center flex-shrink-0"><GraduationCap size={18} className="text-white"/></div>
            <div><p className="text-white font-bold text-sm leading-tight">GSS Gadau</p><p className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">Exam Portal</p></div>
          </div>
        </div>
        {/* User */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:user?.avatar_color||'#6366f1'}}>{ini}</div>
            <div className="min-w-0"><p className="text-white text-sm font-semibold truncate">{user?.full_name}</p><p className="text-white/40 text-xs capitalize">{user?.role}{user?.class?` · ${user.class}`:''}</p></div>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {nav.map(({to,icon:Icon,label,end})=>{
            const active=end?loc.pathname===to:loc.pathname.startsWith(to);
            return <Link key={to} to={to} onClick={()=>setOpen(false)} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-all',active?'bg-white/10 text-white':'text-white/50 hover:text-white/80 hover:bg-white/5')}><Icon size={17} className="flex-shrink-0"/>{label}{active&&<ChevronRight size={14} className="ml-auto opacity-60"/>}</Link>;
          })}
        </nav>
        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button onClick={doLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"><LogOut size={17}/>Sign Out</button>
        </div>
      </aside>
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 flex-shrink-0">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" onClick={()=>setOpen(!open)}><Menu size={20}/></button>
          <div className="flex-1"/>
          <div className="flex items-center gap-2">
            <Link to={`/${user?.role}/notifications`} className="relative w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <Bell size={17}/>
              {unread>0&&<span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">{unread>9?'9+':unread}</span>}
            </Link>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:user?.avatar_color||'#6366f1'}}>{ini}</div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

function PageHeader({title,sub,action}) {
  return <div className="flex items-start justify-between mb-6 flex-wrap gap-3"><div><h1 className="text-2xl font-extrabold text-primary-950">{title}</h1>{sub&&<p className="text-slate-400 text-sm mt-1">{sub}</p>}</div>{action}</div>;
}

// ─── NOTIFICATIONS PAGE ────────────────────────────────────────────────────────
function Notifications() {
  const [data,setData]=useState({notifications:[],unread_count:0}); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/notifications').then(r=>setData(r)).finally(()=>setLoading(false)); },[]);
  const markAll=async()=>{ await api.put('/notifications'); setData(d=>({...d,unread_count:0,notifications:d.notifications.map(n=>({...n,is_read:true}))})); toast.success('All marked as read'); };
  const tc={info:'border-blue-200 bg-blue-50',success:'border-emerald-200 bg-emerald-50',warning:'border-amber-200 bg-amber-50',exam:'border-purple-200 bg-purple-50'};
  return (
    <div className="animate-fadeup">
      <PageHeader title="Notifications" sub={data.unread_count>0?`${data.unread_count} unread`:'All caught up'} action={data.unread_count>0&&<Btn variant="ghost" size="sm" icon={Check} onClick={markAll}>Mark all read</Btn>}/>
      {loading?<div className="flex justify-center py-20"><Spinner lg/></div>
      :data.notifications.length===0?<Card className="text-center py-20"><Bell size={40} className="mx-auto text-slate-300 mb-4"/><p className="text-slate-400">No notifications yet</p></Card>
      :<div className="flex flex-col gap-3">
        {data.notifications.map(n=>(
          <div key={n.id} className={cn('border rounded-xl p-4 flex gap-3 transition-opacity',tc[n.type]||tc.info,n.is_read&&'opacity-60')}>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-sm font-semibold',n.is_read?'text-slate-600':'text-primary-900')}>{n.title}</span>
                {!n.is_read&&<span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"/>}
              </div>
              <p className="text-xs text-slate-600 mt-1">{n.message}</p>
              <p className="text-xs text-slate-400 mt-1.5">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── LANDING ──────────────────────────────────────────────────────────────────
const CLASSES=['JSS 1','JSS 2','JSS 3','SS 1','SS 2','SS 3'];
function Landing() {
  const [ac,setAc]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>setAc(p=>(p+1)%CLASSES.length),2000); return()=>clearInterval(t); },[]);
  const features=[{icon:Shield,title:'Secure CBT',desc:'Tab-switch detection, copy prevention, and fullscreen mode ensure exam integrity.',color:'indigo'},{icon:Database,title:'Question Bank',desc:'Build and reuse a rich library of questions with difficulty ratings and categories.',color:'purple'},{icon:BarChart3,title:'Live Analytics',desc:'Real-time charts and reports for teachers and administrators.',color:'amber'},{icon:Zap,title:'Instant Results',desc:'Auto-graded exams with detailed answer explanations delivered immediately.',color:'emerald'}];
  return (
    <div className="min-h-screen bg-primary-950 text-white" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/8 bg-primary-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-amber-400 flex items-center justify-center"><GraduationCap size={18}/></div>
            <div><p className="font-bold text-sm">GSS Gadau</p><p className="text-white/40 text-[9px] tracking-widest uppercase">Exam Portal</p></div>
          </div>
          <div className="flex gap-2">
            <Link to="/login" className="px-4 py-2 rounded-xl border border-white/15 text-white/70 text-sm font-semibold hover:border-white/30 hover:text-white transition-all">Sign In</Link>
            <Link to="/register" className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-primary-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all">Get Started</Link>
          </div>
        </div>
      </nav>
      {/* Hero */}
      <section className="pt-28 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl animate-float"/>
          <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-amber-500/8 blur-3xl animate-float" style={{animationDelay:'3s'}}/>
          <svg className="absolute inset-0 w-full h-full opacity-4"><defs><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0L0 0 0 48" fill="none" stroke="#c7d2fe" strokeWidth=".5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/></svg>
        </div>
        <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-fadeup">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-6"><Star size={12}/> Government Secondary School Gadau · Bauchi State</div>
            <h1 className="font-serif text-5xl lg:text-6xl font-bold leading-tight mb-5">Nigeria's Most<br/><span className="gradient-text">Intelligent</span><br/>Exam Platform</h1>
            <p className="text-white/50 text-lg leading-relaxed mb-8 max-w-lg">A complete CBT examination ecosystem — from question banks to real-time analytics — built exclusively for GSS Gadau students and staff.</p>
            <div className="flex flex-wrap gap-2 mb-8">{CLASSES.map((cls,i)=><span key={cls} onClick={()=>setAc(i)} className={cn('px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all',i===ac?'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40':'text-white/30 border border-white/8 hover:text-white/50')}>{cls}</span>)}</div>
            <div className="flex gap-3 flex-wrap">
              <Link to="/register" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-primary-600 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:-translate-y-0.5">Get Started <ChevronRight size={16}/></Link>
              <Link to="/login" className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/12 text-white/60 font-bold text-sm hover:border-white/25 hover:text-white/80 transition-all">Admin Login</Link>
            </div>
          </div>
          {/* Demo card */}
          <div className="animate-fadeup relative" style={{animationDelay:'.2s'}}>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div><p className="text-white/40 text-xs mb-1">ACTIVE EXAM</p><p className="text-white font-bold text-lg">Mathematics — SS 2</p></div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> LIVE</div>
              </div>
              <div className="bg-primary-900/60 border border-white/8 rounded-xl p-4 mb-3">
                <p className="text-white/40 text-xs mb-2">Question 3 of 20 · <span className="text-amber-400 font-bold">⏱ 42:18</span></p>
                <p className="text-white/85 text-sm leading-relaxed">What is the value of <em className="text-indigo-300">x</em> in the equation: 3x + 12 = 27?</p>
              </div>
              {[['A','x = 3',false],['B','x = 5',true],['C','x = 7',false],['D','x = 9',false]].map(([l,t,c])=>(
                <div key={l} className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl mb-2 text-sm transition-all',c?'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold':'bg-white/3 border border-white/6 text-white/50')}>
                  <span className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',c?'bg-emerald-500 text-white':'bg-white/8')}>{c?'✓':l}</span>{t}
                </div>
              ))}
              <div className="mt-4 flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                <span className="text-amber-400 text-xs font-semibold flex items-center gap-1.5"><Flag size={12}/> 2 questions flagged for review</span>
                <span className="text-white/40 text-xs">14/20 answered</span>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-sm rounded-2xl p-3 animate-float shadow-lg">
              <p className="text-emerald-400 text-xs font-semibold mb-0.5">Latest Score</p>
              <p className="text-emerald-300 text-2xl font-extrabold">94%</p>
              <p className="text-emerald-500 text-xs">Grade A · Excellent</p>
            </div>
          </div>
        </div>
      </section>
      {/* Stats */}
      <div className="border-y border-white/8 py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[['2,400+','Students Enrolled'],['180+','Exams Conducted'],['10K+','Questions in Bank'],['24/7','System Uptime']].map(([v,l])=>(
            <div key={l}><p className="font-serif text-3xl font-bold text-white mb-1">{v}</p><p className="text-white/40 text-xs">{l}</p></div>
          ))}
        </div>
      </div>
      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14"><h2 className="font-serif text-4xl font-bold text-white mb-3">Enterprise-Grade Features</h2><p className="text-white/40 text-base">Built for modern CBT examination management</p></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map(({icon:Icon,title,desc,color})=>(
              <div key={title} className="bg-white/3 border border-white/8 rounded-2xl p-6 hover:bg-white/6 hover:border-white/15 transition-all">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4',`bg-${color}-500/20`)}><Icon size={20} className={`text-${color}-400`}/></div>
                <h3 className="text-white font-bold text-sm mb-2">{title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* CTA */}
      <section className="py-20 px-6 text-center border-t border-white/8">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-amber-400 flex items-center justify-center mx-auto mb-6"><GraduationCap size={28}/></div>
          <h2 className="font-serif text-5xl font-bold text-white mb-4">Ready to Excel?</h2>
          <p className="text-white/40 text-lg mb-8">Join GSS Gadau's digital examination revolution.</p>
          <div className="flex gap-3 justify-center flex-wrap mb-8">
            <Link to="/register" className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-primary-600 text-white font-bold shadow-xl shadow-indigo-500/30 hover:-translate-y-0.5 transition-all">Register Now</Link>
            <Link to="/login" className="px-8 py-3.5 rounded-xl border border-white/12 text-white/60 font-bold hover:text-white/80 transition-all">Sign In</Link>
          </div>
          <p className="text-white/25 text-xs">Default admin: <code className="text-indigo-400">admin@gssgadau.edu.ng</code> / <code className="text-indigo-400">Admin@2024</code></p>
        </div>
      </section>
      <footer className="border-t border-white/8 py-8 text-center"><p className="text-white/25 text-xs">© 2024 Government Secondary School Gadau, Bauchi State. All rights reserved.</p></footer>
    </div>
  );
}

// ─── AUTH PAGES ────────────────────────────────────────────────────────────────
const SUBJECTS=['Mathematics','English Language','Physics','Chemistry','Biology','Geography','History','Civic Education','Agricultural Science','Economics','Government','Literature','Further Mathematics','Computer Science'];
function AuthShell({title,sub,children}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-amber-400 flex items-center justify-center shadow-2xl shadow-indigo-500/30"><GraduationCap size={26} className="text-white"/></div>
            <span className="text-white/70 text-sm font-semibold">GSS Gadau Exam Portal</span>
          </Link>
          <h1 className="text-3xl font-extrabold text-white mt-4 mb-1">{title}</h1>
          <p className="text-white/40 text-sm">{sub}</p>
        </div>
        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-white/20">{children}</div>
      </div>
    </div>
  );
}
function Login() {
  const {login}=useAuth(); const nav=useNavigate();
  const [form,setForm]=useState({email:'',password:''}); const [show,setShow]=useState(false); const [loading,setLoading]=useState(false);
  const handle=async e=>{ e.preventDefault(); setLoading(true); try{ const u=await login(form.email,form.password); toast.success(`Welcome back, ${u.full_name.split(' ')[0]}!`); nav(u.role==='admin'?'/admin':u.role==='teacher'?'/teacher':'/student'); }catch(e){ toast.error(e.message); }finally{setLoading(false);} };
  return (
    <AuthShell title="Welcome Back" sub="Sign in to your account">
      <form onSubmit={handle} className="flex flex-col gap-5">
        <Input label="Email Address" type="email" placeholder="you@gssgadau.edu.ng" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} icon={User}/>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
          <div className="relative">
            <input className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" type={show?'text':'password'} placeholder="Enter password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
            <button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
          </div>
        </div>
        <Btn type="submit" disabled={loading} className="w-full mt-1">{loading?<><Spinner/>Signing in…</>:'Sign In'}</Btn>
      </form>
      <p className="text-center mt-5 text-sm text-slate-500">No account? <Link to="/register" className="text-primary-600 font-semibold hover:text-primary-700">Register here</Link></p>
      <div className="mt-4 p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-slate-100">Demo admin: <strong className="text-primary-600">admin@gssgadau.edu.ng</strong> / <strong className="text-primary-600">Admin@2024</strong></div>
    </AuthShell>
  );
}
function Register() {
  const {register}=useAuth(); const nav=useNavigate();
  const [form,setForm]=useState({full_name:'',email:'',password:'',role:'student',class:'',student_id:'',subject_specialization:''}); const [show,setShow]=useState(false); const [loading,setLoading]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handle=async e=>{ e.preventDefault(); if(form.password.length<6) return toast.error('Password must be at least 6 characters'); if(form.role==='student'&&!form.class) return toast.error('Please select your class'); setLoading(true); try{ const u=await register(form); toast.success('Account created! Welcome 🎉'); nav(u.role==='admin'?'/admin':u.role==='teacher'?'/teacher':'/student'); }catch(e){ toast.error(e.message); }finally{setLoading(false);} };
  return (
    <AuthShell title="Create Account" sub="Join the GSS Gadau Exam Portal">
      <form onSubmit={handle} className="flex flex-col gap-4">
        <Input label="Full Name" placeholder="e.g. Aisha Suleiman" required value={form.full_name} onChange={e=>set('full_name',e.target.value)} icon={User}/>
        <Input label="Email Address" type="email" placeholder="email@example.com" required value={form.email} onChange={e=>set('email',e.target.value)} icon={User}/>
        <Select label="I am a…" value={form.role} onChange={e=>set('role',e.target.value)}><option value="student">Student</option><option value="teacher">Teacher</option></Select>
        {form.role==='student'&&<div className="grid grid-cols-2 gap-3"><Select label="Class" value={form.class} onChange={e=>set('class',e.target.value)} required><option value="">Select class</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select><Input label="Student ID (opt.)" placeholder="GSS/24/001" value={form.student_id} onChange={e=>set('student_id',e.target.value)}/></div>}
        {form.role==='teacher'&&<Select label="Subject Specialisation" value={form.subject_specialization} onChange={e=>set('subject_specialization',e.target.value)}><option value="">Select subject</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}</Select>}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
          <div className="relative"><input className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary-400" type={show?'text':'password'} placeholder="Min. 6 characters" required value={form.password} onChange={e=>set('password',e.target.value)}/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>
        </div>
        <Btn type="submit" disabled={loading} className="w-full mt-1">{loading?<><Spinner/>Creating…</>:'Create Account'}</Btn>
      </form>
      <p className="text-center mt-4 text-sm text-slate-500">Already have an account? <Link to="/login" className="text-primary-600 font-semibold">Sign in</Link></p>
    </AuthShell>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
const ADMIN_NAV=[{to:'/admin',icon:LayoutDashboard,label:'Dashboard',end:true},{to:'/admin/users',icon:Users,label:'Users'},{to:'/admin/subjects',icon:BookOpen,label:'Subjects'},{to:'/admin/exams',icon:FileText,label:'Exams'},{to:'/admin/results',icon:BarChart3,label:'Results'},{to:'/admin/bank',icon:Database,label:'Question Bank'},{to:'/admin/announce',icon:Megaphone,label:'Announce'},{to:'/admin/notifications',icon:Bell,label:'Notifications'}];
function AdminDashboard(){ return <Layout nav={ADMIN_NAV}><Routes><Route index element={<AdminHome/>}/><Route path="users" element={<AdminUsers/>}/><Route path="subjects" element={<AdminSubjects/>}/><Route path="exams" element={<AdminExams/>}/><Route path="results" element={<AdminResults/>}/><Route path="bank" element={<QuestionBank/>}/><Route path="announce" element={<AdminAnnounce/>}/><Route path="notifications" element={<Notifications/>}/></Routes></Layout>; }

function AdminHome() {
  const [stats,setStats]=useState(null); const [analytics,setAnalytics]=useState(null); const [recent,setRecent]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ Promise.all([api.get('/admin-stats'),api.get('/analytics'),api.get('/admin-results')]).then(([s,a,r])=>{ setStats(s); setAnalytics(a); setRecent(r.slice(0,6)); }).finally(()=>setLoading(false)); },[]);
  if(loading) return <div className="flex justify-center py-32"><Spinner lg/></div>;
  const gradeLabels=analytics?.grades.map(g=>g.grade)||[]; const gradeCounts=analytics?.grades.map(g=>+g.c)||[];
  const dailyLabels=analytics?.daily.map(d=>d.d)||[]; const dailyCounts=analytics?.daily.map(d=>+d.c)||[];
  return (
    <div className="animate-fadeup">
      <PageHeader title="Admin Dashboard" sub="Overview of GSS Gadau Examination System"/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={stats?.users.total||0} color="indigo" icon={Users}/>
        <StatCard label="Total Exams" value={stats?.exams.total||0} color="purple" icon={FileText}/>
        <StatCard label="Submissions" value={stats?.attempts.total||0} color="emerald" icon={CheckCircle}/>
        <StatCard label="Avg Score" value={`${stats?.attempts.avg_score||0}%`} color="amber" icon={TrendingUp}/>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Students" value={stats?.users.student||0} color="sky" icon={GraduationCap}/>
        <StatCard label="Teachers" value={stats?.users.teacher||0} color="rose" icon={User}/>
        <StatCard label="Subjects" value={stats?.subjects||0} color="amber" icon={BookOpen}/>
      </div>
      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><PieChart size={16} className="text-primary-500"/>Grade Distribution</h3>{gradeCounts.length>0?<GChart type="doughnut" data={{labels:gradeLabels,datasets:[{data:gradeCounts,backgroundColor:['#10b981','#3b82f6','#f59e0b','#f97316','#ef4444','#8b5cf6'],borderWidth:2,borderColor:'#fff'}]}} height={200}/>:<p className="text-slate-400 text-sm text-center py-12">No submissions yet</p>}</Card>
        <Card><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><Activity size={16} className="text-primary-500"/>Submissions (7 Days)</h3>{dailyCounts.length>0?<GChart type="bar" data={{labels:dailyLabels,datasets:[{label:'Submissions',data:dailyCounts,backgroundColor:'rgba(99,102,241,0.15)',borderColor:'#6366f1',borderWidth:2,borderRadius:6}]}} height={200}/>:<p className="text-slate-400 text-sm text-center py-12">No recent submissions</p>}</Card>
      </div>
      {/* Exam Status */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {[['Draft',stats?.exams.draft||0,'slate'],['Published',stats?.exams.published||0,'blue'],['Active',stats?.exams.active||0,'green'],['Completed',stats?.exams.completed||0,'purple'],['Archived',stats?.exams.archived||0,'amber'],['Question Bank',analytics?.bankCount||0,'indigo']].slice(0,3).map(([l,v,c])=>(
          <div key={l} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">{l}</span><Badge color={c}>{v}</Badge></div>
        ))}
      </div>
      {/* Recent results table */}
      <Card pad={false}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100"><h3 className="font-bold text-primary-950">Recent Submissions</h3><Link to="/admin/results" className="text-xs text-primary-600 font-semibold hover:text-primary-700">View all →</Link></div>
        <Table headers={['Student','Class','Exam','Score','Grade','Date']}>
          {recent.map(r=>(
            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
              <td className="font-semibold text-primary-950">{r.student_name}</td>
              <td><Badge color="slate">{r.class}</Badge></td>
              <td className="text-slate-500 max-w-[180px] truncate">{r.exam_title}</td>
              <td className="font-bold">{r.score}/{r.total_marks} <span className="text-slate-400 font-normal">({parseFloat(r.percentage).toFixed(0)}%)</span></td>
              <td><span className={cn('font-bold text-base',gc(r.grade))}>{r.grade}</span></td>
              <td className="text-slate-400">{new Date(r.submitted_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function AdminUsers() {
  const [users,setUsers]=useState([]); const [total,setTotal]=useState(0); const [search,setSearch]=useState(''); const [roleF,setRoleF]=useState(''); const [modal,setModal]=useState(null); const [form,setForm]=useState({}); const [saving,setSaving]=useState(false); const [loading,setLoading]=useState(true);
  const EMPTY={full_name:'',email:'',password:'',role:'student',class:'',student_id:'',subject_specialization:''};
  const load=async()=>{ setLoading(true); try{ const d=await api.get(`/admin-users?role=${roleF}&search=${encodeURIComponent(search)}`); setUsers(d.users); setTotal(d.total); }finally{setLoading(false);} };
  useEffect(()=>{ load(); },[roleF,search]);
  const save=async e=>{ e.preventDefault(); setSaving(true); try{
    if(modal==='create'){const d=await api.post('/admin-users',form);setUsers(p=>[d,...p]);toast.success('User created');}
    else{const d=await api.put(`/admin-users?id=${modal.id}`,form);setUsers(p=>p.map(u=>u.id===d.id?{...u,...d}:u));toast.success('Updated');}
    setModal(null);}catch(e){toast.error(e.message);}finally{setSaving(false);} };
  const toggle=async u=>{ try{ await api.put(`/admin-users?id=${u.id}`,{is_active:!u.is_active}); setUsers(p=>p.map(x=>x.id===u.id?{...x,is_active:!x.is_active}:x)); toast.success(u.is_active?'Deactivated':'Activated'); }catch{toast.error('Error');} };
  return (
    <div className="animate-fadeup">
      <PageHeader title="Users" sub={`${total} total users`} action={<Btn icon={Plus} onClick={()=>{setForm(EMPTY);setModal('create');}}>Add User</Btn>}/>
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input icon={Search} placeholder="Search name or email…" className="flex-1 min-w-[200px]" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400" value={roleF} onChange={e=>setRoleF(e.target.value)}><option value="">All Roles</option>{['student','teacher','admin'].map(r=><option key={r} value={r} className="capitalize">{r}</option>)}</select>
      </div>
      <Card pad={false}>
        <Table headers={['Name','Email','Role','Class/Subject','Status','Actions']} loading={loading} empty="No users found">
          {users.map(u=>(
            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
              <td><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:u.avatar_color||'#6366f1'}}>{initials(u.full_name)}</div><span className="font-semibold text-sm text-primary-950">{u.full_name}</span></div></td>
              <td className="text-slate-500 text-xs">{u.email}</td>
              <td><Badge color={u.role==='admin'?'red':u.role==='teacher'?'blue':'green'}>{u.role}</Badge></td>
              <td className="text-slate-400 text-xs">{u.class||u.subject_specialization||'—'}</td>
              <td><Badge color={u.is_active?'green':'slate'}>{u.is_active?'Active':'Inactive'}</Badge></td>
              <td><div className="flex gap-2"><Btn variant="ghost" size="sm" icon={Edit2} onClick={()=>{setForm({...u,password:''});setModal(u);}}/><Btn variant={u.is_active?'danger':'success'} size="sm" onClick={()=>toggle(u)}>{u.is_active?'Deactivate':'Activate'}</Btn></div></td>
            </tr>
          ))}
        </Table>
      </Card>
      {modal&&<Modal title={modal==='create'?'Add New User':'Edit User'} onClose={()=>setModal(null)}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <Input label="Full Name" required value={form.full_name||''} onChange={e=>setForm({...form,full_name:e.target.value})}/>
          <Input label="Email" type="email" required value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Role" value={form.role||'student'} onChange={e=>setForm({...form,role:e.target.value})}>{['student','teacher','admin'].map(r=><option key={r} value={r}>{r}</option>)}</Select>
            {form.role==='student'&&<Select label="Class" value={form.class||''} onChange={e=>setForm({...form,class:e.target.value})}><option value="">Select</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select>}
          </div>
          {modal==='create'&&<Input label="Password (default: Password@123)" type="password" placeholder="Leave blank for default" value={form.password||''} onChange={e=>setForm({...form,password:e.target.value})}/>}
          <div className="flex gap-3 justify-end pt-2"><Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn><Btn type="submit" disabled={saving}>{saving?<Spinner/>:modal==='create'?'Create User':'Save Changes'}</Btn></div>
        </form>
      </Modal>}
    </div>
  );
}

function AdminSubjects() {
  const [subjects,setSubjects]=useState([]); const [teachers,setTeachers]=useState([]); const [modal,setModal]=useState(null); const [form,setForm]=useState({name:'',code:'',class_level:'',teacher_id:'',description:''}); const [saving,setSaving]=useState(false);
  useEffect(()=>{ Promise.all([api.get('/admin-subjects'),api.get('/admin-users?role=teacher')]).then(([s,u])=>{setSubjects(s);setTeachers(u.users);}); },[]);
  const save=async e=>{ e.preventDefault();setSaving(true);try{
    if(modal==='new'){const d=await api.post('/admin-subjects',form);setSubjects(p=>[d,...p]);toast.success('Created');}
    else{const d=await api.put(`/admin-subjects?id=${modal.id}`,form);setSubjects(p=>p.map(s=>s.id===d.id?d:s));toast.success('Updated');}
    setModal(null);}catch(e){toast.error(e.message);}finally{setSaving(false);} };
  const del=async id=>{ if(!confirm('Delete subject?')) return; try{ await api.delete(`/admin-subjects?id=${id}`); setSubjects(p=>p.filter(s=>s.id!==id)); toast.success('Deleted'); }catch{toast.error('Cannot delete — exams depend on it');} };
  return (
    <div className="animate-fadeup">
      <PageHeader title="Subjects" sub={`${subjects.length} configured`} action={<Btn icon={Plus} onClick={()=>{setForm({name:'',code:'',class_level:'',teacher_id:'',description:''});setModal('new');}}>Add Subject</Btn>}/>
      <Card pad={false}>
        <Table headers={['Subject','Code','Class','Teacher','Actions']} empty="No subjects yet">
          {subjects.map(s=>(
            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
              <td className="font-semibold text-primary-950">{s.name}</td>
              <td><code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">{s.code}</code></td>
              <td><Badge color="indigo">{s.class_level}</Badge></td>
              <td className="text-slate-400 text-xs">{s.teacher_name||'Unassigned'}</td>
              <td><div className="flex gap-2"><Btn variant="ghost" size="sm" icon={Edit2} onClick={()=>{setForm({name:s.name,code:s.code,class_level:s.class_level,teacher_id:s.teacher_id||'',description:s.description||''});setModal(s);}}/><Btn variant="danger" size="sm" icon={Trash2} onClick={()=>del(s.id)}/></div></td>
            </tr>
          ))}
        </Table>
      </Card>
      {modal&&<Modal title={modal==='new'?'Add Subject':'Edit Subject'} onClose={()=>setModal(null)}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3"><Input label="Name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><Input label="Code" required placeholder="e.g. MATH" value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})}/></div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Class Level" value={form.class_level} onChange={e=>setForm({...form,class_level:e.target.value})} required><option value="">Select class</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select>
            <Select label="Assigned Teacher" value={form.teacher_id} onChange={e=>setForm({...form,teacher_id:e.target.value})}><option value="">None</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</Select>
          </div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label><textarea className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
          <div className="flex gap-3 justify-end pt-2"><Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn><Btn type="submit" disabled={saving}>{saving?<Spinner/>:modal==='new'?'Create':'Save'}</Btn></div>
        </form>
      </Modal>}
    </div>
  );
}

function AdminExams() {
  const [exams,setExams]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/exams').then(r=>setExams(r)).finally(()=>setLoading(false)); },[]);
  const del=async id=>{ if(!confirm('Delete this exam and all questions?')) return; try{ await api.delete(`/exams?id=${id}`); setExams(p=>p.filter(e=>e.id!==id)); toast.success('Deleted'); }catch{toast.error('Error');} };
  return (
    <div className="animate-fadeup">
      <PageHeader title="All Exams" sub={`${exams.length} exams in system`}/>
      <Card pad={false}>
        <Table headers={['Title','Subject','Class','Teacher','Questions','Submissions','Status','']} loading={loading} empty="No exams yet">
          {exams.map(e=>(
            <tr key={e.id} className="hover:bg-slate-50 transition-colors">
              <td className="font-semibold text-primary-950 max-w-[180px] truncate">{e.title}</td>
              <td className="text-slate-400 text-xs">{e.subject_name||'—'}</td>
              <td><Badge color="indigo">{e.class_level}</Badge></td>
              <td className="text-slate-400 text-xs">{e.teacher_name||'—'}</td>
              <td className="text-center"><Badge color="slate">{e.question_count||0}</Badge></td>
              <td className="text-center"><Badge color="emerald">{e.submissions||0}</Badge></td>
              <td><StatusBadge s={e.status}/></td>
              <td><Btn variant="danger" size="sm" icon={Trash2} onClick={()=>del(e.id)}/></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function AdminResults() {
  const [results,setResults]=useState([]); const [search,setSearch]=useState(''); const [loading,setLoading]=useState(true); const [analytics,setAnalytics]=useState(null);
  useEffect(()=>{ Promise.all([api.get('/admin-results'),api.get('/analytics')]).then(([r,a])=>{setResults(r);setAnalytics(a);}).finally(()=>setLoading(false)); },[]);
  const filtered=results.filter(r=>!search||r.student_name?.toLowerCase().includes(search.toLowerCase())||r.exam_title?.toLowerCase().includes(search.toLowerCase()));
  const exportCSV=()=>{ window.open('/api/export-results','_blank'); };
  const topLabels=analytics?.topExams.map(e=>e.title.substring(0,20))||[]; const topAvg=analytics?.topExams.map(e=>+e.avg)||[];
  return (
    <div className="animate-fadeup">
      <PageHeader title="Exam Results" sub={`${results.length} total submissions`} action={<Btn icon={Download} variant="ghost" onClick={exportCSV}>Export CSV</Btn>}/>
      {analytics?.topExams?.length>0&&<Card className="mb-4"><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-primary-500"/>Top Exams by Avg Score</h3><GChart type="bar" data={{labels:topLabels,datasets:[{label:'Avg Score (%)',data:topAvg,backgroundColor:'rgba(99,102,241,0.12)',borderColor:'#6366f1',borderWidth:2,borderRadius:6}]}} height={200}/></Card>}
      <div className="flex gap-3 mb-4"><Input icon={Search} placeholder="Search student or exam…" className="max-w-xs" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <Card pad={false}>
        <Table headers={['Student','Class','Exam','Score','%','Grade','Tab Switches','Date']} loading={loading} empty="No results found">
          {filtered.map(r=>(
            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
              <td className="font-semibold text-sm text-primary-950">{r.student_name}</td>
              <td><Badge color="slate">{r.class}</Badge></td>
              <td className="text-slate-400 text-xs max-w-[160px] truncate">{r.exam_title}</td>
              <td className="font-bold">{r.score}/{r.total_marks}</td>
              <td className={cn('font-bold',gc(r.grade))}>{parseFloat(r.percentage).toFixed(1)}%</td>
              <td><span className={cn('font-extrabold text-base',gc(r.grade))}>{r.grade}</span></td>
              <td>{(r.tab_switches||0)>0?<Badge color="red">{r.tab_switches} switches</Badge>:<Badge color="green">Clean</Badge>}</td>
              <td className="text-slate-400 text-xs">{new Date(r.submitted_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function AdminAnnounce() {
  const {user}=useAuth(); const [ann,setAnn]=useState([]); const [form,setForm]=useState({title:'',content:'',target_role:'',is_pinned:false}); const [saving,setSaving]=useState(false);
  useEffect(()=>{ api.get('/admin-announce').then(r=>setAnn(r)); },[]);
  const submit=async e=>{ e.preventDefault();setSaving(true);try{const d=await api.post('/admin-announce',form);setAnn(p=>[d,...p]);setForm({title:'',content:'',target_role:'',is_pinned:false});toast.success('Posted!');}catch(e){toast.error(e.message);}finally{setSaving(false);} };
  return (
    <div className="animate-fadeup">
      <PageHeader title="Announcements"/>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><Send size={15} className="text-primary-500"/>Post Announcement</h3>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input label="Title" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Content</label><textarea className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none min-h-[100px]" required value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Target" value={form.target_role} onChange={e=>setForm({...form,target_role:e.target.value})}><option value="">All users</option><option value="student">Students only</option><option value="teacher">Teachers only</option></Select>
              <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Options</label><label className="flex items-center gap-2 cursor-pointer mt-1"><input type="checkbox" className="w-4 h-4 rounded" checked={form.is_pinned} onChange={e=>setForm({...form,is_pinned:e.target.checked})}/><span className="text-sm text-slate-600">Pin to top</span></label></div>
            </div>
            <Btn type="submit" disabled={saving} icon={Send}>{saving?<Spinner/>:'Post Announcement'}</Btn>
          </form>
        </Card>
        <Card pad={false}>
          <div className="p-4 border-b border-slate-100 font-bold text-primary-950">Posted ({ann.length})</div>
          <div className="overflow-y-auto max-h-[400px]">
            {ann.map(a=>(
              <div key={a.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                {a.is_pinned&&<span className="text-amber-600 text-xs font-bold block mb-1">📌 PINNED</span>}
                <p className="text-sm font-semibold text-primary-950">{a.title}</p>
                <p className="text-xs text-slate-400 mt-1">{a.target_role?`For ${a.target_role}s`:'Everyone'} · {new Date(a.created_at).toLocaleDateString()}</p>
              </div>
            ))}
            {!ann.length&&<p className="text-slate-400 text-sm text-center py-12">No announcements yet</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── QUESTION BANK ─────────────────────────────────────────────────────────────
function QuestionBank({embedded=false,onImport=null,examId=null}) {
  const [qs,setQs]=useState([]); const [total,setTotal]=useState(0); const [subjects,setSubjects]=useState([]); const [loading,setLoading]=useState(true);
  const [filters,setFilters]=useState({search:'',subject_id:'',difficulty:'',type:''}); const [modal,setModal]=useState(null); const [form,setForm]=useState({}); const [saving,setSaving]=useState(false);
  const [selected,setSelected]=useState(new Set()); const [importing,setImporting]=useState(false);
  const QEMPTY={question_text:'',question_type:'mcq',options:['','','',''],correct_answer:'',marks:1,explanation:'',subject_id:'',difficulty:'medium',category:''};
  const load=async()=>{ setLoading(true); const p=new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v))); try{ const d=await api.get(`/question-bank?${p}`); setQs(d.questions); setTotal(d.total); }finally{setLoading(false);} };
  useEffect(()=>{ api.get('/subjects').then(r=>setSubjects(r)); },[]);
  useEffect(()=>{ load(); },[filters]);
  const save=async e=>{ e.preventDefault(); setSaving(true); try{
    const payload={...form,options:form.question_type==='mcq'?form.options:null};
    if(modal==='new'){const d=await api.post('/question-bank',payload);setQs(p=>[d,...p]);toast.success('Question added to bank');}
    else{const d=await api.put(`/question-bank?id=${modal.id}`,payload);setQs(p=>p.map(q=>q.id===d.id?d:q));toast.success('Updated');}
    setModal(null);}catch(e){toast.error(e.message);}finally{setSaving(false);} };
  const del=async id=>{ if(!confirm('Delete from bank?')) return; try{ await api.delete(`/question-bank?id=${id}`); setQs(p=>p.filter(q=>q.id!==id)); toast.success('Deleted'); }catch{toast.error('Error');} };
  const toggleSel=id=>{ setSelected(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; }); };
  const doImport=async()=>{ if(!selected.size) return toast.error('Select at least one question'); setImporting(true); try{ const d=await api.post('/question-bank-import',{exam_id:examId,question_ids:[...selected]}); toast.success(`${d.imported} questions imported!`); setSelected(new Set()); onImport?.(); }catch(e){toast.error(e.message);}finally{setImporting(false);} };
  const typeBadge=t=>({mcq:<Badge color="blue">MCQ</Badge>,true_false:<Badge color="purple">T/F</Badge>,short_answer:<Badge color="amber">Short</Badge>})[t]||null;
  const wrap = embedded ? ({children})=><div>{children}</div> : ({children})=><div className="animate-fadeup">{children}</div>;
  return (
    <wrap.type>
      {!embedded&&<PageHeader title="Question Bank" sub={`${total} questions stored`} action={<Btn icon={Plus} onClick={()=>{setForm(QEMPTY);setModal('new');}}>Add Question</Btn>}/>}
      {embedded&&<div className="flex items-center justify-between mb-3"><h3 className="font-bold text-primary-950 flex items-center gap-2"><Database size={15}/>Question Bank — Select to Import</h3><div className="flex gap-2">{selected.size>0&&<Btn icon={Upload} size="sm" variant="amber" onClick={doImport} disabled={importing}>{importing?<Spinner/>:`Import ${selected.size} Selected`}</Btn>}<Btn icon={Plus} size="sm" onClick={()=>{setForm(QEMPTY);setModal('new');}}>New Question</Btn></div></div>}
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input icon={Search} placeholder="Search questions…" className="flex-1 min-w-[180px]" value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}/>
        <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400" value={filters.subject_id} onChange={e=>setFilters(f=>({...f,subject_id:e.target.value}))}><option value="">All Subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400" value={filters.difficulty} onChange={e=>setFilters(f=>({...f,difficulty:e.target.value}))}><option value="">All Difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400" value={filters.type} onChange={e=>setFilters(f=>({...f,type:e.target.value}))}><option value="">All Types</option><option value="mcq">MCQ</option><option value="true_false">True/False</option><option value="short_answer">Short Answer</option></select>
      </div>
      <Card pad={false}>
        <Table headers={embedded?['','Question','Type','Diff.','Marks','Subject']:['Question','Type','Diff.','Marks','Used','Subject','Actions']} loading={loading} empty="No questions found. Start building your bank!">
          {qs.map(q=>(
            <tr key={q.id} className={cn('hover:bg-slate-50 transition-colors',embedded&&selected.has(q.id)&&'bg-indigo-50')}>
              {embedded&&<td className="w-8"><input type="checkbox" className="w-4 h-4 rounded accent-indigo-600" checked={selected.has(q.id)} onChange={()=>toggleSel(q.id)}/></td>}
              <td className="max-w-[260px]"><p className="text-sm text-primary-950 font-medium truncate">{q.question_text}</p>{q.category&&<p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Tag size={10}/>{q.category}</p>}</td>
              <td>{typeBadge(q.question_type)}</td>
              <td><DiffBadge d={q.difficulty}/></td>
              <td className="text-center font-semibold text-slate-600">{q.marks}</td>
              {!embedded&&<td className="text-center"><Badge color="slate">{q.usage_count||0}</Badge></td>}
              <td className="text-slate-400 text-xs">{q.subject_name||'—'}</td>
              {!embedded&&<td><div className="flex gap-2"><Btn variant="ghost" size="sm" icon={Edit2} onClick={()=>{setForm({...q,options:Array.isArray(q.options)?q.options:JSON.parse(q.options||'[]')});setModal(q);}}/><Btn variant="danger" size="sm" icon={Trash2} onClick={()=>del(q.id)}/></div></td>}
            </tr>
          ))}
        </Table>
      </Card>
      {/* Question modal */}
      {modal&&<Modal title={modal==='new'?'Add to Question Bank':'Edit Question'} onClose={()=>setModal(null)} size="lg">
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question Text</label><textarea className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none min-h-[80px]" required rows={3} value={form.question_text||''} onChange={e=>setForm({...form,question_text:e.target.value})}/></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Select label="Type" value={form.question_type||'mcq'} onChange={e=>setForm({...form,question_type:e.target.value,options:e.target.value==='mcq'?['','','','']:null,correct_answer:''})}><option value="mcq">MCQ</option><option value="true_false">True/False</option><option value="short_answer">Short Answer</option></Select>
            <Select label="Difficulty" value={form.difficulty||'medium'} onChange={e=>setForm({...form,difficulty:e.target.value})}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marks</label><input className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" type="number" min={1} max={20} value={form.marks||1} onChange={e=>setForm({...form,marks:+e.target.value})}/></div>
            <Select label="Subject" value={form.subject_id||''} onChange={e=>setForm({...form,subject_id:e.target.value})}><option value="">None</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          </div>
          <Input label="Category / Topic (optional)" placeholder="e.g. Algebra, Photosynthesis" value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})} icon={Tag}/>
          {form.question_type==='mcq'&&<div className="flex flex-col gap-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Options — select correct one</label>{(form.options||['','','','']).map((o,i)=><div key={i} className="flex items-center gap-2"><span className="w-6 text-xs font-bold text-slate-400 text-center">{String.fromCharCode(65+i)}</span><input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder={`Option ${String.fromCharCode(65+i)}`} value={o} onChange={e=>{const opts=[...(form.options||[])];opts[i]=e.target.value;setForm({...form,options:opts});}}/><input type="radio" name="correct_bank" checked={form.correct_answer===o} onChange={()=>setForm({...form,correct_answer:o})} className="w-4 h-4 accent-indigo-600"/><span className="text-xs text-slate-400">Correct</span></div>)}{!form.correct_answer&&<p className="text-red-500 text-xs">⚠ Select the correct option</p>}</div>}
          {form.question_type==='true_false'&&<Select label="Correct Answer" value={form.correct_answer||''} onChange={e=>setForm({...form,correct_answer:e.target.value})} required><option value="">Select</option><option value="True">True</option><option value="False">False</option></Select>}
          {form.question_type==='short_answer'&&<Input label="Correct Answer (case-insensitive)" required value={form.correct_answer||''} onChange={e=>setForm({...form,correct_answer:e.target.value})}/>}
          <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Explanation (shown after exam)</label><textarea className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" rows={2} value={form.explanation||''} onChange={e=>setForm({...form,explanation:e.target.value})}/></div>
          <div className="flex gap-3 justify-end pt-2"><Btn variant="ghost" onClick={()=>setModal(null)}>Cancel</Btn><Btn type="submit" disabled={saving||(form.question_type==='mcq'&&!form.correct_answer)}>{saving?<Spinner/>:modal==='new'?'Add to Bank':'Save'}</Btn></div>
        </form>
      </Modal>}
    </wrap.type>
  );
}

// ─── TEACHER ──────────────────────────────────────────────────────────────────
const TEACHER_NAV=[{to:'/teacher',icon:LayoutDashboard,label:'Dashboard',end:true},{to:'/teacher/exams',icon:FileText,label:'My Exams'},{to:'/teacher/bank',icon:Database,label:'Question Bank'},{to:'/teacher/notifications',icon:Bell,label:'Notifications'}];
function TeacherDashboard(){ return <Layout nav={TEACHER_NAV}><Routes><Route index element={<TeacherHome/>}/><Route path="exams" element={<TeacherExams/>}/><Route path="exams/new" element={<ExamEditor/>}/><Route path="exams/:id" element={<ExamEditor/>}/><Route path="exams/:id/results" element={<ExamResults/>}/><Route path="bank" element={<QuestionBank/>}/><Route path="notifications" element={<Notifications/>}/></Routes></Layout>; }

function TeacherHome() {
  const {user}=useAuth(); const [exams,setExams]=useState([]); const [analytics,setAnalytics]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{ Promise.all([api.get('/exams'),api.get('/analytics')]).then(([e,a])=>{setExams(e);setAnalytics(a);}).finally(()=>setLoading(false)); },[]);
  const total=exams.length; const active=exams.filter(e=>e.status==='active').length; const subs=exams.reduce((a,e)=>a+(+e.submissions||0),0); const avg=analytics?.grades?.length>0?Math.round(analytics.grades.reduce((a,g)=>a+(+g.c),0)>0?analytics.topExams.reduce((a,e)=>a+(+e.avg),0)/(analytics.topExams.length||1):0):0;
  const dailyLabels=analytics?.daily.map(d=>d.d)||[]; const dailyCounts=analytics?.daily.map(d=>+d.c)||[];
  return (
    <div className="animate-fadeup">
      <PageHeader title={`Hello, ${user?.full_name?.split(' ')[0]} 👋`} sub="Teacher Dashboard"/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="My Exams" value={total} color="indigo" icon={FileText}/>
        <StatCard label="Active Now" value={active} color="emerald" icon={Zap}/>
        <StatCard label="Total Submissions" value={subs} color="amber" icon={CheckCircle}/>
        <StatCard label="Bank Questions" value={analytics?.bankCount||0} color="purple" icon={Database}/>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><Activity size={15} className="text-primary-500"/>Submissions (7 Days)</h3>{dailyCounts.length>0?<GChart type="line" data={{labels:dailyLabels,datasets:[{label:'Submissions',data:dailyCounts,borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,0.08)',fill:true,tension:.4,pointBackgroundColor:'#6366f1',pointRadius:4}]}} height={180}/>:<p className="text-slate-400 text-sm text-center py-10">No recent submissions</p>}</Card>
        <Card pad={false}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between"><h3 className="font-bold text-primary-950">Recent Exams</h3><Link to="/teacher/exams/new" className="text-xs text-primary-600 font-semibold">+ New Exam</Link></div>
          {loading?<div className="py-8 flex justify-center"><Spinner/></div>:<div className="divide-y divide-slate-50">{exams.slice(0,5).map(e=><div key={e.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"><div className="min-w-0"><p className="text-sm font-semibold text-primary-950 truncate">{e.title}</p><p className="text-xs text-slate-400 mt-0.5">{e.question_count||0} questions · {e.submissions||0} submissions</p></div><div className="flex items-center gap-2 flex-shrink-0 ml-3"><StatusBadge s={e.status}/><Link to={`/teacher/exams/${e.id}`} className="text-xs text-primary-600 font-semibold">Edit</Link></div></div>)}{!exams.length&&<p className="text-center text-slate-400 text-sm py-10">No exams yet</p>}</div>}
        </Card>
      </div>
    </div>
  );
}

function TeacherExams() {
  const [exams,setExams]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/exams').then(r=>setExams(r)).finally(()=>setLoading(false)); },[]);
  const publish=async id=>{ try{ await api.post(`/exams?id=${id}&action=publish`); setExams(p=>p.map(e=>e.id===id?{...e,status:'published'}:e)); toast.success('Exam published!'); }catch(e){toast.error(e.message);} };
  const del=async id=>{ if(!confirm('Delete exam?')) return; try{ await api.delete(`/exams?id=${id}`); setExams(p=>p.filter(e=>e.id!==id)); toast.success('Deleted'); }catch{toast.error('Error');} };
  return (
    <div className="animate-fadeup">
      <PageHeader title="My Exams" sub={`${exams.length} exams`} action={<Link to="/teacher/exams/new"><Btn icon={Plus}>New Exam</Btn></Link>}/>
      {loading?<div className="flex justify-center py-20"><Spinner lg/></div>:
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.map(e=>(
          <Card key={e.id} className="flex flex-col">
            <div className="flex items-start justify-between mb-3"><StatusBadge s={e.status}/>{e.cbt_mode&&<Badge color="indigo"><Shield size={10}/> CBT</Badge>}</div>
            <h3 className="font-bold text-primary-950 mb-1 text-base">{e.title}</h3>
            <p className="text-xs text-slate-400 mb-3">{e.subject_name||'General'} · {e.class_level}</p>
            <div className="flex gap-3 text-xs text-slate-400 mb-4"><span className="flex items-center gap-1"><ListChecks size={12}/>{e.question_count||0} Q</span><span className="flex items-center gap-1"><Clock size={12}/>{e.duration_minutes}min</span><span className="flex items-center gap-1"><Users size={12}/>{e.submissions||0} submissions</span></div>
            <div className="flex gap-2 mt-auto flex-wrap">
              <Link to={`/teacher/exams/${e.id}`}><Btn variant="ghost" size="sm" icon={Edit2}>Edit</Btn></Link>
              {e.status==='draft'&&+e.question_count>0&&<Btn size="sm" icon={Zap} onClick={()=>publish(e.id)}>Publish</Btn>}
              {e.submissions>0&&<Link to={`/teacher/exams/${e.id}/results`}><Btn variant="success" size="sm" icon={BarChart3}>Results</Btn></Link>}
              <Btn variant="danger" size="sm" icon={Trash2} onClick={()=>del(e.id)}/>
            </div>
          </Card>
        ))}
        {!exams.length&&<div className="col-span-3 text-center py-20 text-slate-400"><FileText size={40} className="mx-auto mb-3 opacity-30"/><p>No exams yet. <Link to="/teacher/exams/new" className="text-primary-600 font-semibold">Create your first →</Link></p></div>}
      </div>}
    </div>
  );
}

function ExamEditor() {
  const {id}=useParams(); const nav=useNavigate(); const isEdit=!!id;
  const EF={title:'',subject_id:'',class_level:'',instructions:'',duration_minutes:60,pass_mark:50,show_results_immediately:true,max_attempts:1,randomize_questions:false,cbt_mode:true};
  const QF={question_text:'',question_type:'mcq',options:['','','',''],correct_answer:'',marks:1,explanation:''};
  const [form,setForm]=useState(EF); const [questions,setQuestions]=useState([]); const [subjects,setSubjects]=useState([]); const [saving,setSaving]=useState(false); const [loading,setLoading]=useState(!!id);
  const [qModal,setQModal]=useState(null); const [qForm,setQForm]=useState(QF); const [qSaving,setQSaving]=useState(false);
  const [showBank,setShowBank]=useState(false);
  useEffect(()=>{ api.get('/subjects').then(r=>setSubjects(r)); if(id){api.get(`/exams?id=${id}`).then(r=>{setForm({...EF,...r});setQuestions(r.questions||[]);}).finally(()=>setLoading(false));}else{setLoading(false);} },[id]);
  const saveExam=async e=>{ e.preventDefault();setSaving(true);try{
    if(isEdit){await api.put(`/exams?id=${id}`,form);toast.success('Saved');}
    else{const d=await api.post('/exams',form);toast.success('Exam created');nav(`/teacher/exams/${d.id}`);}
  }catch(e){toast.error(e.message);}finally{setSaving(false);} };
  const publish=async()=>{ try{ await api.post(`/exams?id=${id}&action=publish`); setForm(f=>({...f,status:'published'})); toast.success('Exam published!'); }catch(e){toast.error(e.message);} };
  const openQ=(q=null)=>{ setQForm(q?{question_text:q.question_text,question_type:q.question_type,options:Array.isArray(q.options)?q.options:JSON.parse(q.options||'[]'),correct_answer:q.correct_answer,marks:q.marks,explanation:q.explanation||''}:{...QF,options:['','','','']}); setQModal(q||'new'); };
  const saveQ=async e=>{ e.preventDefault(); if(qForm.question_type==='mcq'&&!qForm.correct_answer) return toast.error('Select the correct option'); setQSaving(true);
    try{
      if(qModal==='new'){const d=await api.post(`/exams?id=${id}&action=questions`,{...qForm,options:qForm.question_type==='mcq'?qForm.options:null});setQuestions(p=>[...p,d]);}
      else{const d=await api.put(`/exams?id=${qModal.id}&action=questions&qid=${qModal.id}`,{...qForm,options:qForm.question_type==='mcq'?qForm.options:null});setQuestions(p=>p.map(q=>q.id===d.id?d:q));}
      setQModal(null);toast.success('Saved');
    }catch(e){toast.error(e.message);}finally{setQSaving(false);} };
  const delQ=async qid=>{ if(!confirm('Delete?')) return; try{ await api.delete(`/exams?id=${id}&action=questions&qid=${qid}`); setQuestions(p=>p.filter(q=>q.id!==qid)); toast.success('Deleted'); }catch{toast.error('Error');} };
  const refreshQs=async()=>{ const r=await api.get(`/exams?id=${id}`); setQuestions(r.questions||[]); };
  const exportToBank=async()=>{ try{ const d=await api.post('/question-bank-export',{exam_id:id}); toast.success(`${d.exported} questions exported to bank!`); }catch(e){toast.error(e.message);} };
  if(loading) return <div className="flex justify-center py-32"><Spinner lg/></div>;
  return (
    <div className="animate-fadeup">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/teacher/exams" className="text-slate-400 hover:text-primary-600 transition-colors"><ArrowLeft size={20}/></Link>
        <h1 className="text-2xl font-extrabold text-primary-950">{isEdit?'Edit Exam':'Create Exam'}</h1>
        {isEdit&&form.status&&<StatusBadge s={form.status}/>}
        {isEdit&&form.status==='draft'&&questions.length>0&&<Btn size="sm" icon={Zap} onClick={publish}>Publish</Btn>}
      </div>
      <Card className="mb-4">
        <h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><Settings size={15} className="text-primary-500"/>Exam Settings</h3>
        <form onSubmit={saveExam} className="grid lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2"><Input label="Exam Title" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
          <Select label="Subject" value={form.subject_id||''} onChange={e=>setForm({...form,subject_id:e.target.value})}><option value="">None</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select label="Class Level" value={form.class_level||''} onChange={e=>setForm({...form,class_level:e.target.value})} required><option value="">Select class</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration (minutes)</label><input className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" type="number" min={5} value={form.duration_minutes} onChange={e=>setForm({...form,duration_minutes:+e.target.value})}/></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pass Mark (%)</label><input className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" type="number" min={1} max={100} value={form.pass_mark} onChange={e=>setForm({...form,pass_mark:+e.target.value})}/></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Max Attempts</label><input className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" type="number" min={1} value={form.max_attempts} onChange={e=>setForm({...form,max_attempts:+e.target.value})}/></div>
          <div className="flex flex-col gap-3"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Options</label>
            {[['show_results_immediately','Show results immediately'],['randomize_questions','Randomize question order'],['cbt_mode','Enable CBT mode (anti-cheat)']].map(([k,l])=><label key={k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded accent-indigo-600" checked={!!form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})}/><span className="text-sm text-slate-600">{l}</span></label>)}
          </div>
          <div className="lg:col-span-2 flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instructions</label><textarea className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" rows={2} placeholder="Instructions shown to students before starting…" value={form.instructions||''} onChange={e=>setForm({...form,instructions:e.target.value})}/></div>
          <div className="lg:col-span-2"><Btn type="submit" disabled={saving}>{saving?<Spinner/>:isEdit?'Save Changes':'Create Exam'}</Btn></div>
        </form>
      </Card>
      {isEdit&&<Card className="mb-4">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h3 className="font-bold text-primary-950 flex items-center gap-2"><ListChecks size={15} className="text-primary-500"/>Questions <span className="text-slate-400 font-normal text-sm">({questions.length})</span></h3>
          <div className="flex gap-2"><Btn variant="ghost" size="sm" icon={Upload} onClick={()=>setShowBank(!showBank)}>{showBank?'Hide Bank':'Import from Bank'}</Btn>{questions.length>0&&<Btn variant="ghost" size="sm" icon={Download} onClick={exportToBank}>Export to Bank</Btn>}<Btn size="sm" icon={Plus} onClick={()=>openQ()}>Add Question</Btn></div>
        </div>
        {showBank&&<div className="mb-6 border border-slate-200 rounded-2xl p-4 bg-slate-50"><QuestionBank embedded examId={id} onImport={()=>{refreshQs();setShowBank(false);}}/></div>}
        {questions.map((q,i)=>(
          <div key={q.id} className="border border-slate-200 rounded-xl p-4 mb-3 hover:border-primary-200 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                  {({mcq:<Badge color="blue">MCQ</Badge>,true_false:<Badge color="purple">T/F</Badge>,short_answer:<Badge color="amber">Short</Badge>})[q.question_type]}
                  <Badge color="slate">{q.marks} mark{q.marks!==1?'s':''}</Badge>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{q.question_text}</p>
                {q.options&&<div className="flex flex-wrap gap-1.5 mt-2">{(Array.isArray(q.options)?q.options:JSON.parse(q.options||'[]')).map((o,j)=><span key={j} className={cn('text-xs px-2.5 py-0.5 rounded-full',o===q.correct_answer?'bg-emerald-100 text-emerald-700 font-semibold':'bg-slate-100 text-slate-500')}>{o}</span>)}</div>}
                {q.question_type!=='mcq'&&<p className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1"><Check size={11}/>Correct: {q.correct_answer}</p>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Btn variant="ghost" size="sm" icon={Edit2} onClick={()=>openQ(q)}/>
                <Btn variant="danger" size="sm" icon={Trash2} onClick={()=>delQ(q.id)}/>
              </div>
            </div>
          </div>
        ))}
        {!questions.length&&<div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl"><AlertCircle size={32} className="mx-auto mb-2 opacity-40"/><p className="text-sm">No questions yet. Add one above or import from the Question Bank.</p></div>}
      </Card>}
      {qModal&&<Modal title={qModal==='new'?'Add Question':'Edit Question'} onClose={()=>setQModal(null)} size="lg">
        <form onSubmit={saveQ} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question Text</label><textarea className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" required rows={3} value={qForm.question_text} onChange={e=>setQForm({...qForm,question_text:e.target.value})}/></div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Question Type" value={qForm.question_type} onChange={e=>setQForm({...qForm,question_type:e.target.value,options:e.target.value==='mcq'?['','','','']:null,correct_answer:''})}><option value="mcq">Multiple Choice</option><option value="true_false">True / False</option><option value="short_answer">Short Answer</option></Select>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marks</label><input className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" type="number" min={1} max={20} value={qForm.marks} onChange={e=>setQForm({...qForm,marks:+e.target.value})}/></div>
          </div>
          {qForm.question_type==='mcq'&&<div className="flex flex-col gap-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Options — select correct one</label>{(qForm.options||['','','','']).map((o,i)=><div key={i} className="flex items-center gap-2"><span className="w-6 text-center text-xs font-bold text-slate-400">{String.fromCharCode(65+i)}</span><input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder={`Option ${String.fromCharCode(65+i)}`} value={o} onChange={e=>{const opts=[...(qForm.options||[])];opts[i]=e.target.value;setQForm({...qForm,options:opts});}}/><input type="radio" name="qcorrect" checked={qForm.correct_answer===o} onChange={()=>setQForm({...qForm,correct_answer:o})} className="w-4 h-4 accent-indigo-600"/><label className="text-xs text-slate-400">Correct</label></div>)}{!qForm.correct_answer&&<p className="text-red-500 text-xs mt-1">⚠ Select the correct option</p>}</div>}
          {qForm.question_type==='true_false'&&<Select label="Correct Answer" value={qForm.correct_answer} onChange={e=>setQForm({...qForm,correct_answer:e.target.value})} required><option value="">Select</option><option value="True">True</option><option value="False">False</option></Select>}
          {qForm.question_type==='short_answer'&&<Input label="Correct Answer (case-insensitive)" required value={qForm.correct_answer} onChange={e=>setQForm({...qForm,correct_answer:e.target.value})}/>}
          <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Explanation (optional)</label><textarea className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" rows={2} value={qForm.explanation} onChange={e=>setQForm({...qForm,explanation:e.target.value})}/></div>
          <div className="flex gap-3 justify-end"><Btn variant="ghost" onClick={()=>setQModal(null)}>Cancel</Btn><Btn type="submit" disabled={qSaving||(qForm.question_type==='mcq'&&!qForm.correct_answer)}>{qSaving?<Spinner/>:qModal==='new'?'Add Question':'Save'}</Btn></div>
        </form>
      </Modal>}
    </div>
  );
}

function ExamResults() {
  const {id}=useParams(); const [results,setResults]=useState([]); const [exam,setExam]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{ Promise.all([api.get(`/exams?id=${id}`),api.get(`/exams?id=${id}&action=results`)]).then(([e,r])=>{setExam(e);setResults(r);}).finally(()=>setLoading(false)); },[id]);
  const avg=results.length?(results.reduce((a,r)=>a+parseFloat(r.percentage||0),0)/results.length).toFixed(1):0;
  const pass=results.filter(r=>parseFloat(r.percentage)>=(exam?.pass_mark||50)).length;
  const gradeMap=results.reduce((a,r)=>{a[r.grade]=(a[r.grade]||0)+1;return a;},{});
  const scoreData={labels:Object.keys(gradeMap),datasets:[{data:Object.values(gradeMap),backgroundColor:['#10b981','#3b82f6','#f59e0b','#f97316','#ef4444','#8b5cf6'],borderWidth:2,borderColor:'#fff'}]};
  const exportCSV=()=>{ window.open(`/api/export-results?exam_id=${id}`,'_blank'); };
  if(loading) return <div className="flex justify-center py-32"><Spinner lg/></div>;
  return (
    <div className="animate-fadeup">
      <div className="flex items-center gap-3 mb-6"><Link to="/teacher/exams" className="text-slate-400 hover:text-primary-600"><ArrowLeft size={20}/></Link><h1 className="text-2xl font-extrabold text-primary-950">{exam?.title} — Results</h1></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Submissions" value={results.length} color="indigo" icon={Users}/>
        <StatCard label="Average Score" value={`${avg}%`} color="emerald" icon={TrendingUp}/>
        <StatCard label="Highest Score" value={results[0]?`${parseFloat(results[0].percentage).toFixed(0)}%`:'—'} color="amber" icon={Award}/>
        <StatCard label="Pass Rate" value={`${results.length?Math.round(pass/results.length*100):0}%`} color="sky" icon={Target}/>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2"><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-primary-500"/>Score Distribution</h3>{results.length>0?<GChart type="bar" data={{labels:results.slice(0,15).map(r=>r.student_name.split(' ')[0]),datasets:[{label:'Score (%)',data:results.slice(0,15).map(r=>parseFloat(r.percentage).toFixed(1)),backgroundColor:'rgba(99,102,241,0.12)',borderColor:'#6366f1',borderWidth:2,borderRadius:6}]}} height={200}/>:<p className="text-slate-400 text-sm text-center py-12">No data yet</p>}</Card>
        <Card><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><PieChart size={15} className="text-primary-500"/>Grade Distribution</h3>{results.length>0?<GChart type="doughnut" data={scoreData} height={200}/>:<p className="text-slate-400 text-sm text-center py-12">No data yet</p>}</Card>
      </div>
      <Card pad={false}>
        <div className="p-4 flex items-center justify-between border-b border-slate-100"><h3 className="font-bold text-primary-950">Student Results</h3><Btn variant="ghost" size="sm" icon={Download} onClick={exportCSV}>Export CSV</Btn></div>
        <Table headers={['#','Student','ID','Score','%','Grade','Time','Tab Switches','Submitted']}>
          {results.map((r,i)=>(
            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
              <td className="text-slate-400 text-xs">{i+1}</td>
              <td className="font-semibold text-sm text-primary-950">{r.student_name}</td>
              <td className="text-slate-400 text-xs">{r.student_no||'—'}</td>
              <td className="font-bold">{r.score}/{r.total_marks}</td>
              <td className={cn('font-bold',gc(r.grade))}>{parseFloat(r.percentage).toFixed(1)}%</td>
              <td><span className={cn('font-extrabold text-lg',gc(r.grade))}>{r.grade}</span></td>
              <td className="text-slate-400 text-xs">{r.time_taken_minutes}m</td>
              <td>{(r.tab_switches||0)>0?<Badge color="red">{r.tab_switches}</Badge>:<Badge color="green">0</Badge>}</td>
              <td className="text-slate-400 text-xs">{new Date(r.submitted_at).toLocaleString()}</td>
            </tr>
          ))}
          {!results.length&&<tr><td colSpan={9} className="py-16 text-center text-slate-400 text-sm">No submissions yet</td></tr>}
        </Table>
      </Card>
    </div>
  );
}

// ─── STUDENT ──────────────────────────────────────────────────────────────────
const STUDENT_NAV=[{to:'/student',icon:LayoutDashboard,label:'Dashboard',end:true},{to:'/student/exams',icon:FileText,label:'My Exams'},{to:'/student/history',icon:BookCheck,label:'History'},{to:'/student/notifications',icon:Bell,label:'Notifications'}];
function StudentDashboard(){ return <Layout nav={STUDENT_NAV}><Routes><Route index element={<StudentHome/>}/><Route path="exams" element={<StudentExams/>}/><Route path="exams/:examId/take" element={<TakeExam/>}/><Route path="results/:id" element={<ExamResult/>}/><Route path="history" element={<StudentHistory/>}/><Route path="notifications" element={<Notifications/>}/></Routes></Layout>; }

function StudentHome() {
  const {user}=useAuth(); const [exams,setExams]=useState([]); const [history,setHistory]=useState([]); const [ann,setAnn]=useState([]);
  useEffect(()=>{ Promise.all([api.get('/exams'),api.get('/attempts?action=history'),api.get('/announcements')]).then(([e,h,a])=>{setExams(e);setHistory(h);setAnn(a);}); },[]);
  const submitted=history.filter(h=>h.status==='submitted');
  const avg=submitted.length?(submitted.reduce((a,h)=>a+parseFloat(h.percentage||0),0)/submitted.length).toFixed(1):0;
  const available=exams.filter(e=>e.status==='published'||e.status==='active');
  const recentScores=submitted.slice(0,6).reverse();
  return (
    <div className="animate-fadeup">
      <PageHeader title={`Hello, ${user?.full_name?.split(' ')[0]} 👋`} sub={`${user?.class} · Student Portal`}/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Available Exams" value={available.length} color="indigo" icon={FileText}/>
        <StatCard label="Completed" value={submitted.length} color="emerald" icon={CheckCircle}/>
        <StatCard label="Avg Score" value={`${avg}%`} color="amber" icon={TrendingUp}/>
        <StatCard label="In Progress" value={history.filter(h=>h.status==='in_progress').length} color="sky" icon={Clock}/>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {recentScores.length>0&&<Card className="lg:col-span-2"><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-primary-500"/>My Recent Scores</h3><GChart type="bar" data={{labels:recentScores.map(h=>h.exam_title.substring(0,16)),datasets:[{label:'Score (%)',data:recentScores.map(h=>parseFloat(h.percentage||0).toFixed(1)),backgroundColor:recentScores.map(h=>parseFloat(h.percentage||0)>=(50)?'rgba(16,185,129,0.15)':'rgba(244,63,94,0.15)'),borderColor:recentScores.map(h=>parseFloat(h.percentage||0)>=(50)?'#10b981':'#f43f5e'),borderWidth:2,borderRadius:6}]}} height={180}/></Card>}
        <Card><h3 className="font-bold text-primary-950 mb-4 flex items-center gap-2"><Megaphone size={15} className="text-primary-500"/>Announcements</h3>
          {ann.length===0?<p className="text-slate-400 text-sm text-center py-8">No announcements</p>
          :ann.slice(0,4).map(a=><div key={a.id} className="py-2.5 border-b border-slate-50 last:border-0">{a.is_pinned&&<span className="text-amber-600 text-xs font-bold block mb-0.5">📌 PINNED</span>}<p className="text-sm font-semibold text-primary-950">{a.title}</p><p className="text-xs text-slate-400 mt-0.5">{new Date(a.created_at).toLocaleDateString()}</p></div>)}
        </Card>
      </div>
      <Card pad={false}>
        <div className="p-4 border-b border-slate-100 font-bold text-primary-950 flex items-center gap-2"><Zap size={15} className="text-amber-500"/>Available Exams</div>
        {available.length===0?<p className="text-center py-12 text-slate-400 text-sm">No exams available right now</p>
        :available.map(e=><div key={e.id} className="flex items-center justify-between p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"><div className="min-w-0"><p className="text-sm font-semibold text-primary-950 truncate">{e.title}</p><p className="text-xs text-slate-400 mt-0.5">{e.subject_name} · ⏱ {e.duration_minutes}min</p></div>{e.attempt_id?<Link to={`/student/results/${e.attempt_id}`}><Btn variant="ghost" size="sm">View Result</Btn></Link>:<Link to={`/student/exams/${e.id}/take`}><Btn size="sm">Start →</Btn></Link>}</div>)}
      </Card>
    </div>
  );
}

function StudentExams() {
  const [exams,setExams]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/exams').then(r=>setExams(r)).finally(()=>setLoading(false)); },[]);
  if(loading) return <div className="flex justify-center py-20"><Spinner lg/></div>;
  return (
    <div className="animate-fadeup">
      <PageHeader title="My Exams" sub="All exams available for your class"/>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.map(e=>(
          <Card key={e.id} className="flex flex-col">
            <div className="flex items-start justify-between mb-3"><StatusBadge s={e.status}/>{e.my_score!=null&&<span className="text-emerald-600 text-sm font-bold flex items-center gap-1"><CheckCircle size={13}/>{parseFloat(e.my_score).toFixed(0)}%</span>}</div>
            <h3 className="font-bold text-primary-950 text-base mb-1 leading-tight">{e.title}</h3>
            <p className="text-xs text-slate-400 mb-3">{e.subject_name||'General'} · {e.teacher_name}</p>
            <div className="flex gap-3 text-xs text-slate-400 mb-4"><span className="flex items-center gap-1"><ListChecks size={12}/>{e.question_count||0} Q</span><span className="flex items-center gap-1"><Clock size={12}/>{e.duration_minutes}min</span><span className="flex items-center gap-1"><Target size={12}/>Pass: {e.pass_mark}%</span></div>
            {e.attempt_id?<Link to={`/student/results/${e.attempt_id}`} className="mt-auto"><Btn variant="ghost" className="w-full" icon={CheckCircle}>View Result</Btn></Link>
            :(e.status==='published'||e.status==='active')?<Link to={`/student/exams/${e.id}/take`} className="mt-auto"><Btn className="w-full">Start Exam →</Btn></Link>
            :<Btn variant="ghost" className="w-full mt-auto opacity-50 cursor-not-allowed" disabled>Not Available</Btn>}
          </Card>
        ))}
        {!exams.length&&<div className="col-span-3 text-center py-20 text-slate-400"><FileText size={40} className="mx-auto mb-3 opacity-30"/><p>No exams available. Check back later.</p></div>}
      </div>
    </div>
  );
}

// ─── CBT EXAM ────────────────────────────────────────────────────────────────
function TakeExam() {
  const {examId}=useParams(); const nav=useNavigate();
  const [exam,setExam]=useState(null); const [attempt,setAttempt]=useState(null); const [answers,setAnswers]=useState({}); const [flagged,setFlagged]=useState(new Set()); const [current,setCurrent]=useState(0); const [timeLeft,setTimeLeft]=useState(null); const [phase,setPhase]=useState('loading'); const [result,setResult]=useState(null); const [tabSwitches,setTabSwitches]=useState(0);
  const timerRef=useRef(null); const attemptRef=useRef(null); const answersRef=useRef({});
  useEffect(()=>{ api.get(`/exams?id=${examId}`).then(r=>{setExam(r);setPhase('intro');}).catch(()=>{toast.error('Exam not found');nav('/student');}); return()=>{clearInterval(timerRef.current);}; },[examId]);
  // Tab switch / copy prevention
  useEffect(()=>{
    if(phase!=='exam') return;
    const onVis=()=>{ if(document.hidden){ setTabSwitches(n=>{ const next=n+1; toast.warning(`⚠️ Tab switch detected (${next}). This is logged.`); if(attemptRef.current) api.put(`/attempts?id=${attemptRef.current}&action=switch`,{}).catch(()=>{}); return next; }); } };
    const blockCopy=e=>{ e.preventDefault(); toast.warning('Copying is not allowed during exams'); };
    document.addEventListener('visibilitychange',onVis);
    document.addEventListener('copy',blockCopy); document.addEventListener('cut',blockCopy); document.addEventListener('paste',blockCopy);
    return()=>{ document.removeEventListener('visibilitychange',onVis); document.removeEventListener('copy',blockCopy); document.removeEventListener('cut',blockCopy); document.removeEventListener('paste',blockCopy); };
  },[phase]);
  const startExam=async()=>{
    try{
      const d=await api.post('/attempts?action=start',{exam_id:examId});
      setAttempt(d.attempt); attemptRef.current=d.attempt.id; setAnswers(d.attempt.answers||{}); answersRef.current=d.attempt.answers||{};
      const secs=(exam.duration_minutes||60)*60; setTimeLeft(secs); setPhase('exam');
      timerRef.current=setInterval(()=>setTimeLeft(t=>{ if(t<=1){clearInterval(timerRef.current);handleSubmit(true);return 0;} return t-1; }),1000);
    }catch(e){toast.error(e.message||'Could not start exam');}
  };
  const selectAnswer=async(qid,ans)=>{ const updated={...answersRef.current,[qid]:ans}; setAnswers(updated); answersRef.current=updated; if(attempt) api.put(`/attempts?id=${attempt.id}&action=answer`,{question_id:qid,answer:ans}).catch(()=>{}); };
  const toggleFlag=qid=>{ setFlagged(f=>{ const n=new Set(f); n.has(qid)?n.delete(qid):n.add(qid); const arr=[...n]; if(attempt) api.put(`/attempts?id=${attempt.id}&action=flag`,{flagged:arr}).catch(()=>{}); return n; }); };
  const handleSubmit=useCallback(async(auto=false)=>{ if(!attempt) return; if(!auto&&!confirm('Submit exam? You cannot change answers after submission.')) return; clearInterval(timerRef.current); setPhase('submitting');
    try{ const d=await api.post(`/attempts?id=${attempt.id}&action=submit`,{answers:answersRef.current}); setResult(d); setPhase('done'); }
    catch(e){ toast.error('Submission failed'); setPhase('exam'); }
  },[attempt]);
  const questions=exam?.questions||[]; const q=questions[current]; const totalQ=questions.length; const answered=Object.keys(answers).length; const pct=totalQ?Math.round(answered/totalQ*100):0; const isLow=timeLeft!==null&&timeLeft<300;
  if(phase==='loading') return <div className="flex justify-center py-32"><Spinner lg/></div>;
  if(phase==='intro') return (
    <div className="max-w-2xl mx-auto animate-fadeup">
      <Card>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4"><FileText size={28} className="text-indigo-500"/></div>
          <h1 className="text-2xl font-extrabold text-primary-950 mb-1">{exam.title}</h1>
          <p className="text-slate-400 text-sm">{exam.subject_name} · {exam.class_level}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[['Questions',exam.questions?.length||0,'📋'],['Duration',`${exam.duration_minutes}min`,'⏱'],['Pass Mark',`${exam.pass_mark}%`,'🎯']].map(([l,v,i])=><div key={l} className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100"><div className="text-2xl mb-1">{i}</div><div className="text-xl font-extrabold text-primary-950">{v}</div><div className="text-xs text-slate-400 mt-1">{l}</div></div>)}
        </div>
        {exam.cbt_mode&&<div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl mb-4"><Shield size={18} className="text-indigo-600 flex-shrink-0 mt-0.5"/><div><p className="text-sm font-semibold text-indigo-900">CBT Mode Active</p><p className="text-xs text-indigo-700 mt-1">Tab switching is detected and logged. Copy/paste is disabled. Your integrity record is important.</p></div></div>}
        {exam.instructions&&<div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4"><p className="text-xs font-bold text-amber-700 mb-2">📌 INSTRUCTIONS</p><p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{exam.instructions}</p></div>}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6 text-sm text-emerald-800">
          <p className="font-bold mb-2">✅ Before you start:</p>
          <ul className="space-y-1 text-xs leading-relaxed list-disc list-inside"><li>Stable internet connection required</li><li>Timer starts immediately — find a quiet place</li><li>Answers are auto-saved as you go</li><li>You can flag questions and review before submitting</li></ul>
        </div>
        <Btn className="w-full text-base" onClick={startExam}>Start Exam — Timer Begins Now →</Btn>
      </Card>
    </div>
  );
  if(phase==='submitting') return <div className="text-center py-32"><Spinner lg/><p className="text-lg font-bold text-primary-950 mt-4">Submitting your exam…</p><p className="text-slate-400 text-sm mt-2">Please wait, do not close this page</p></div>;
  if(phase==='done'&&result) {
    const att=result.attempt; const pct2=parseFloat(att.percentage||0); const pass=pct2>=(exam?.pass_mark||50);
    return (
      <div className="max-w-2xl mx-auto animate-fadeup">
        <Card className="text-center">
          <div className={cn('w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto mb-5 text-4xl',pass?'bg-emerald-50 border-emerald-400':'bg-red-50 border-red-400')}>{pass?'🎉':'😔'}</div>
          <h1 className="text-3xl font-extrabold text-primary-950 mb-2">{pass?'Congratulations!':'Keep Trying!'}</h1>
          <p className="text-slate-400 mb-7">{pass?'You passed this exam!':'You did not meet the pass mark.'}</p>
          <div className="grid grid-cols-3 gap-4 mb-7">
            {[['Score',`${att.score}/${att.total_marks}`,'slate'],['Percentage',`${pct2.toFixed(1)}%`,pass?'green':'red'],['Grade',att.grade,pass?'green':'red']].map(([l,v,c])=><div key={l} className="bg-slate-50 rounded-2xl p-4 border border-slate-100"><p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">{l}</p><p className={cn('text-2xl font-extrabold',c==='green'?'text-emerald-600':c==='red'?'text-red-500':'text-primary-950')}>{v}</p></div>)}
          </div>
          {tabSwitches>0&&<div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-5 text-sm text-amber-800"><AlertTriangle size={16}/>{tabSwitches} tab switch{tabSwitches!==1?'es':''} detected during exam</div>}
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to={`/student/results/${att.id}`}><Btn>View Detailed Results</Btn></Link>
            <Link to="/student/exams"><Btn variant="ghost">Back to Exams</Btn></Link>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-3 mb-4 flex items-center justify-between gap-4 sticky top-16 z-20">
        <div className="min-w-0"><p className="font-bold text-primary-950 text-sm truncate">{exam.title}</p><p className="text-xs text-slate-400 mt-0.5">Q {current+1}/{totalQ} · {answered} answered · {flagged.size} flagged</p></div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2"><div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{width:`${pct}%`}}/></div><span className="text-xs text-slate-400">{pct}%</span></div>
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors',isLow?'bg-red-50 border-red-200 text-red-600':'bg-slate-50 border-slate-200 text-slate-700')}><Clock size={14}/>{timeLeft!==null?fmt(timeLeft):'--:--'}</div>
          {tabSwitches>0&&<div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold"><AlertTriangle size={12}/>{tabSwitches}</div>}
          <Btn variant="danger" size="sm" onClick={()=>handleSubmit(false)}>Submit</Btn>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1fr_220px] gap-4">
        {/* Question panel */}
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{current+1}</span>
            <div className="flex items-center gap-2 flex-wrap">
              {({mcq:<Badge color="blue">MCQ</Badge>,true_false:<Badge color="purple">True/False</Badge>,short_answer:<Badge color="amber">Short Answer</Badge>})[q?.question_type]}
              <Badge color="slate">{q?.marks} mark{q?.marks!==1?'s':''}</Badge>
              {flagged.has(q?.id)&&<Badge color="amber"><Flag size={10}/>Flagged</Badge>}
            </div>
            <button onClick={()=>toggleFlag(q?.id)} className={cn('ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors',flagged.has(q?.id)?'bg-amber-50 border-amber-300 text-amber-700':'bg-slate-50 border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-200')}><Flag size={12}/>{flagged.has(q?.id)?'Unflag':'Flag for Review'}</button>
          </div>
          <p className="text-base text-slate-800 leading-relaxed mb-6 font-medium select-none">{q?.question_text}</p>
          {/* MCQ */}
          {q?.question_type==='mcq'&&<div className="flex flex-col gap-3">{(Array.isArray(q.options)?q.options:JSON.parse(q.options||'[]')).map((opt,i)=>{ const sel=answers[q.id]===opt; return <button key={i} onClick={()=>selectAnswer(q.id,opt)} className={cn('flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all',sel?'border-primary-500 bg-primary-50 text-primary-900':'border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:bg-slate-50')}><span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all',sel?'bg-primary-600 text-white':'bg-slate-100 text-slate-500')}>{sel?<Check size={14}/>:String.fromCharCode(65+i)}</span><span className={cn('text-sm font-medium',sel&&'font-semibold')}>{opt}</span></button>; })}</div>}
          {/* T/F */}
          {q?.question_type==='true_false'&&<div className="grid grid-cols-2 gap-4">{['True','False'].map(opt=>{ const sel=answers[q.id]===opt; return <button key={opt} onClick={()=>selectAnswer(q.id,opt)} className={cn('p-5 rounded-xl border-2 font-bold text-base transition-all',sel?'border-primary-500 bg-primary-50 text-primary-900':'border-slate-200 bg-white text-slate-600 hover:border-primary-200')}>{opt==='True'?'✅ True':'❌ False'}</button>; })}</div>}
          {/* Short answer */}
          {q?.question_type==='short_answer'&&<input className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-400 transition-colors" placeholder="Type your answer here…" value={answers[q?.id]||''} onChange={e=>selectAnswer(q.id,e.target.value)}/>}
          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-5 border-t border-slate-100">
            <Btn variant="ghost" icon={ArrowLeft} onClick={()=>setCurrent(p=>Math.max(0,p-1))} disabled={current===0}>Previous</Btn>
            {current<totalQ-1?<Btn icon={ArrowRight} onClick={()=>setCurrent(p=>Math.min(totalQ-1,p+1))}>Next</Btn>:<Btn variant="success" icon={CheckCircle} onClick={()=>handleSubmit(false)}>Submit Exam</Btn>}
          </div>
        </Card>
        {/* Navigator */}
        <div className="flex flex-col gap-3">
          <Card pad={false}>
            <div className="p-3 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question Navigator</p></div>
            <div className="p-3 grid grid-cols-5 gap-1.5">
              {questions.map((_,i)=>{ const ans2=answers[questions[i]?.id]!==undefined; const act=i===current; const flg=flagged.has(questions[i]?.id); return <button key={i} onClick={()=>setCurrent(i)} className={cn('aspect-square rounded-lg text-xs font-bold border-2 transition-all',act?'border-primary-500 bg-primary-600 text-white':flg?'border-amber-400 bg-amber-50 text-amber-700':ans2?'border-emerald-400 bg-emerald-50 text-emerald-700':'border-slate-200 bg-white text-slate-400 hover:border-primary-200')}>{i+1}</button>; })}
            </div>
            <div className="p-3 pt-0 flex flex-col gap-1.5 text-xs">
              {[['bg-emerald-50 border-emerald-400',`Answered (${answered})`],['bg-amber-50 border-amber-400',`Flagged (${flagged.size})`],['bg-white border-slate-200',`Unanswered (${totalQ-answered})`]].map(([cls,l])=><div key={l} className="flex items-center gap-2"><span className={cn('w-4 h-4 rounded border-2 flex-shrink-0',cls)}/><span className="text-slate-500">{l}</span></div>)}
            </div>
          </Card>
          {exam.cbt_mode&&<div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl"><div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 mb-1"><Shield size={12}/>CBT Mode Active</div>{tabSwitches>0&&<p className="text-xs text-amber-700 mt-1 flex items-center gap-1"><AlertTriangle size={10}/>{tabSwitches} switch{tabSwitches!==1?'es':''} logged</p>}</div>}
          <Btn variant="danger" className="w-full" onClick={()=>handleSubmit(false)}>Submit Exam</Btn>
        </div>
      </div>
    </div>
  );
}

function ExamResult() {
  const {id}=useParams(); const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get(`/attempts?id=${id}&action=result`).then(r=>setData(r)).finally(()=>setLoading(false)); },[id]);
  if(loading) return <div className="flex justify-center py-32"><Spinner lg/></div>;
  if(!data) return <div className="text-center py-32 text-slate-400">Result not found</div>;
  const pct=parseFloat(data.percentage||0); const pass=pct>=(data.pass_mark||50); const answers=typeof data.answers==='string'?JSON.parse(data.answers||'{}'):(data.answers||{});
  return (
    <div className="animate-fadeup">
      <Link to="/student/exams" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-primary-600 text-sm mb-5 transition-colors"><ArrowLeft size={14}/>Back to Exams</Link>
      <h1 className="text-2xl font-extrabold text-primary-950 mb-1">{data.exam_title}</h1>
      <p className="text-slate-400 text-sm mb-6">{data.subject_name} · Submitted {new Date(data.submitted_at).toLocaleString()}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Score" value={`${data.score}/${data.total_marks}`} color="indigo" icon={Award}/>
        <StatCard label="Percentage" value={`${pct.toFixed(1)}%`} color={pass?'emerald':'rose'} icon={TrendingUp}/>
        <StatCard label="Grade" value={data.grade} color={pass?'emerald':'rose'} icon={Star}/>
        <StatCard label="Time Taken" value={`${data.time_taken_minutes}min`} color="sky" icon={Clock}/>
      </div>
      <div className={cn('flex items-center gap-3 p-4 rounded-2xl border mb-6',pass?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200')}>
        <span className="text-3xl">{pass?'🎉':'📚'}</span>
        <div><p className={cn('font-bold text-base',pass?'text-emerald-800':'text-red-800')}>{pass?'You Passed!':'Below Pass Mark'}</p><p className={cn('text-sm mt-0.5',pass?'text-emerald-700':'text-red-700')}>{pass?'Great performance! Keep it up.':'Review the material — you can do better!'}</p></div>
      </div>
      {data.questions?.length>0&&<Card><h3 className="font-bold text-primary-950 mb-5 flex items-center gap-2"><BookCheck size={15} className="text-primary-500"/>Answer Review</h3>
        {data.questions.map((q,i)=>{ const ans=answers[q.id]; const correct=ans?.is_correct; return (
          <div key={q.id} className="py-5 border-b border-slate-100 last:border-0">
            <div className="flex gap-3 items-start">
              <span className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm flex-shrink-0',correct?'bg-emerald-50 border-emerald-400 text-emerald-600':'bg-red-50 border-red-400 text-red-600')}>{correct?<Check size={13}/>:<X size={13}/>}</span>
              <div className="flex-1">
                <p className="text-sm text-slate-800 leading-relaxed mb-3 font-medium"><strong className="text-slate-500">Q{i+1}.</strong> {q.question_text}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200"><p className="font-bold text-red-700 mb-1 uppercase tracking-wider text-[10px]">Your Answer</p><p className="text-red-800">{ans?.student_answer||<em className="opacity-60">Not answered</em>}</p></div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200"><p className="font-bold text-emerald-700 mb-1 uppercase tracking-wider text-[10px]">Correct Answer</p><p className="text-emerald-800 font-semibold">{ans?.correct_answer||q.correct_answer}</p></div>
                </div>
                {q.explanation&&<div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800"><strong>💡 Explanation:</strong> {q.explanation}</div>}
              </div>
            </div>
          </div>
        );})}
      </Card>}
    </div>
  );
}

function StudentHistory() {
  const [history,setHistory]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/attempts?action=history').then(r=>setHistory(r)).finally(()=>setLoading(false)); },[]);
  const submitted=history.filter(h=>h.status==='submitted');
  const avg=submitted.length?(submitted.reduce((a,h)=>a+parseFloat(h.percentage||0),0)/submitted.length).toFixed(1):0;
  return (
    <div className="animate-fadeup">
      <PageHeader title="Exam History" sub="All your past attempts"/>
      {submitted.length>0&&<div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Attempts" value={submitted.length} color="indigo" icon={BookCheck}/>
        <StatCard label="Average Score" value={`${avg}%`} color="emerald" icon={TrendingUp}/>
        <StatCard label="Best Grade" value={submitted.reduce((b,h)=>{ const g={A:1,B:2,C:3,D:4,E:5,F:6}; return (g[h.grade]||7)<(g[b]||7)?h.grade:b; },'—')} color="amber" icon={Award}/>
      </div>}
      <Card pad={false}>
        <Table headers={['Exam','Subject','Score','%','Grade','Status','Date','']} loading={loading} empty="No exam history yet">
          {history.map(h=>(
            <tr key={h.id} className="hover:bg-slate-50 transition-colors">
              <td className="font-semibold text-sm text-primary-950 max-w-[160px] truncate">{h.exam_title}</td>
              <td className="text-slate-400 text-xs">{h.subject_name||'—'}</td>
              <td className="font-bold">{h.status==='submitted'?`${h.score}/${h.total_marks}`:'—'}</td>
              <td className={cn('font-bold',h.grade?gc(h.grade):'text-slate-400')}>{h.percentage?`${parseFloat(h.percentage).toFixed(1)}%`:'—'}</td>
              <td>{h.grade?<span className={cn('font-extrabold text-lg',gc(h.grade))}>{h.grade}</span>:'—'}</td>
              <td><Badge color={h.status==='submitted'?'green':h.status==='in_progress'?'blue':'slate'}>{h.status}</Badge></td>
              <td className="text-slate-400 text-xs">{new Date(h.created_at).toLocaleDateString()}</td>
              <td>{h.status==='submitted'&&<Link to={`/student/results/${h.id}`} className="text-primary-600 text-xs font-semibold hover:text-primary-700">View →</Link>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
function RootRedirect() { const {user}=useAuth(); if(!user) return <Landing/>; if(user.role==='admin') return <Navigate to="/admin" replace/>; if(user.role==='teacher') return <Navigate to="/teacher" replace/>; return <Navigate to="/student" replace/>; }
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster/>
        <Routes>
          <Route path="/" element={<RootRedirect/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/admin/*" element={<Guard role="admin"><AdminDashboard/></Guard>}/>
          <Route path="/teacher/*" element={<Guard role="teacher"><TeacherDashboard/></Guard>}/>
          <Route path="/student/*" element={<Guard role="student"><StudentDashboard/></Guard>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
