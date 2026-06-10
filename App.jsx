import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams, useLocation } from 'react-router-dom';

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toasts = [], _setToasts = null;
const toast = {
  show: (msg, type='info') => { const id=Date.now(); _setToasts?.(p=>[...p,{id,msg,type}]); setTimeout(()=>_setToasts?.(p=>p.filter(t=>t.id!==id)),3500); },
  success: msg => toast.show(msg,'success'),
  error:   msg => toast.show(msg,'error'),
  info:    msg => toast.show(msg,'info'),
};
function Toaster() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => { _setToasts = setToasts; }, []);
  return (
    <div style={{position:'fixed',top:16,right:16,zIndex:9999,display:'flex',flexDirection:'column',gap:9}}>
      {toasts.map(t => (
        <div key={t.id} style={{padding:'11px 18px',borderRadius:12,fontFamily:'var(--font)',fontSize:14,fontWeight:500,maxWidth:320,boxShadow:'0 4px 20px rgba(0,0,0,.15)',
          background:t.type==='success'?'#ecfdf5':t.type==='error'?'#fff1f2':'#eff6ff',
          color:t.type==='success'?'#059669':t.type==='error'?'#e11d48':'#2563eb',
          border:`1px solid ${t.type==='success'?'#bbf7d0':t.type==='error'?'#fecdd3':'#bfdbfe'}`,
          animation:'fadeUp .25s ease both'}}>
          {t.type==='success'?'✓ ':t.type==='error'?'✕ ':'ℹ '}{t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── API ──────────────────────────────────────────────────────────────────────
const API_BASE = '/api';
const apiFetch = async (method, path, data) => {
  const token = localStorage.getItem('gss_token');
  const res = await fetch(API_BASE + path, {
    method, headers: {'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(data ? {body: JSON.stringify(data)} : {})
  });
  const json = await res.json();
  if (!res.ok) { const e = new Error(json.error||'Request failed'); e.data = json; throw e; }
  return json;
};
const api = {
  get:    p          => apiFetch('GET',    p),
  post:   (p, d)     => apiFetch('POST',   p, d),
  put:    (p, d)     => apiFetch('PUT',    p, d),
  delete: p          => apiFetch('DELETE', p),
};

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('gss_user')); } catch { return null; } });
  const login = async (email, password) => {
    const data = await api.post('/login', { email, password });
    localStorage.setItem('gss_token', data.token);
    localStorage.setItem('gss_user', JSON.stringify(data.user));
    setUser(data.user); return data.user;
  };
  const register = async (form) => {
    const data = await api.post('/register', form);
    localStorage.setItem('gss_token', data.token);
    localStorage.setItem('gss_user', JSON.stringify(data.user));
    setUser(data.user); return data.user;
  };
  const logout = () => { localStorage.removeItem('gss_token'); localStorage.removeItem('gss_user'); setUser(null); };
  const refreshUser = async () => { try { const d = await api.get('/me'); setUser(d); localStorage.setItem('gss_user', JSON.stringify(d)); } catch {} };
  return <AuthCtx.Provider value={{user,login,register,logout,refreshUser}}>{children}</AuthCtx.Provider>;
}
const useAuth = () => useContext(AuthCtx);

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children, role: r }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (r && user.role !== r) return <Navigate to={`/${user.role}`} replace />;
  return children;
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const Spinner = ({ lg }) => <span className={`spinner${lg?' spinner-lg':''}`}/>;
const Modal = ({ title, onClose, children, maxWidth=480 }) => (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
    <div style={{background:'white',borderRadius:20,padding:28,width:'100%',maxWidth,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,.2)'}} onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
        <h2 style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{title}</h2>
        <button onClick={onClose} style={{background:'var(--bg-subtle)',border:'none',borderRadius:8,padding:'6px 8px',color:'var(--text-2)'}}>✕</button>
      </div>
      {children}
    </div>
  </div>
);
const StatusBadge = ({ s }) => {
  const m={draft:'badge-draft',published:'badge-published',active:'badge-active',completed:'badge-completed',archived:'badge-archived'};
  return <span className={`badge ${m[s]||'badge-draft'}`} style={{textTransform:'capitalize'}}>{s}</span>;
};

function Layout({ children, nav }) {
  const { user, logout } = useAuth();
  const location = useLocation(); const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => { api.get('/notifications').then(r=>setUnread(r.unread_count)).catch(()=>{}); }, []);
  const doLogout = () => { logout(); navigate('/'); toast.success('Signed out'); };
  const initials = user?.full_name?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
  return (
    <div style={{display:'flex',minHeight:'100vh',background:'var(--bg)'}}>
      <aside style={{width:240,flexShrink:0,background:'var(--primary)',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,bottom:0,zIndex:50,transition:'transform .25s ease'}}
        className={open?'open-sidebar':''}>
        <div style={{padding:'20px 20px 14px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#6366f1,#f59e0b)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>🎓</div>
            <div><div style={{fontSize:13,fontWeight:800,color:'white',lineHeight:1.2}}>GSS Gadau</div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',letterSpacing:'.8px',textTransform:'uppercase'}}>Exam Portal</div></div>
          </div>
        </div>
        <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,borderRadius:99,background:user?.avatar_color||'#6366f1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>{initials}</div>
            <div style={{overflow:'hidden'}}>
              <div style={{fontSize:13,fontWeight:600,color:'white',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{user?.full_name}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,.4)',textTransform:'capitalize'}}>{user?.role}{user?.class?` · ${user.class}`:''}</div>
            </div>
          </div>
        </div>
        <nav style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
          {nav.map(({to,icon,label,end})=>{
            const active = end ? location.pathname===to : location.pathname.startsWith(to);
            return (
              <Link key={to} to={to} onClick={()=>setOpen(false)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 11px',borderRadius:10,marginBottom:2,background:active?'rgba(255,255,255,.1)':'transparent',color:active?'white':'rgba(255,255,255,.5)',fontWeight:active?600:400,fontSize:14,transition:'all .18s'}}>
                <span>{icon}</span>{label}{active&&<span style={{marginLeft:'auto',fontSize:12}}>›</span>}
              </Link>
            );
          })}
        </nav>
        <div style={{padding:'12px 10px',borderTop:'1px solid rgba(255,255,255,.07)'}}>
          <button onClick={doLogout}
            style={{display:'flex',alignItems:'center',gap:10,padding:'9px 11px',borderRadius:10,width:'100%',background:'transparent',color:'rgba(255,255,255,.4)',fontSize:14,transition:'all .18s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(244,63,94,.15)';e.currentTarget.style.color='#f87171'}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(255,255,255,.4)'}}>
            🚪 Sign Out
          </button>
        </div>
      </aside>
      {open && <div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:49}}/>}
      <div style={{flex:1,marginLeft:240,display:'flex',flexDirection:'column',minWidth:0}} className="main-offset">
        <header style={{height:58,background:'white',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',position:'sticky',top:0,zIndex:40,flexShrink:0}}>
          <button className="hide-desktop" onClick={()=>setOpen(!open)} style={{background:'none',color:'var(--text-2)',marginRight:8,fontSize:20}}>☰</button>
          <div style={{flex:1}}/>
          <Link to={`/${user?.role}/notifications`} style={{position:'relative',padding:8,borderRadius:10,background:'var(--bg-subtle)',color:'var(--text-2)',display:'flex',alignItems:'center',justifyContent:'center',marginRight:10}}>
            🔔{unread>0&&<span style={{position:'absolute',top:4,right:4,width:8,height:8,borderRadius:'50%',background:'var(--rose)',border:'2px solid white'}}/>}
          </Link>
          <div style={{width:34,height:34,borderRadius:99,background:user?.avatar_color||'#6366f1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white'}}>{initials}</div>
        </header>
        <main style={{flex:1,padding:'28px 24px',maxWidth:1200,width:'100%',margin:'0 auto'}}>{children}</main>
      </div>
      <style>{`@media(max-width:768px){.main-offset{margin-left:0!important}aside{transform:translateX(-100%)!important}.open-sidebar{transform:translateX(0)!important}.hide-desktop{display:flex!important}}@media(min-width:769px){.hide-desktop{display:none!important}}`}</style>
    </div>
  );
}

// ─── Notifications Page ───────────────────────────────────────────────────────
function Notifications() {
  const [data, setData] = useState({notifications:[],unread_count:0});
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ api.get('/notifications').then(r=>setData(r)).finally(()=>setLoading(false)); },[]);
  const markAll = async () => { try { await api.put('/notifications'); setData(d=>({...d,unread_count:0,notifications:d.notifications.map(n=>({...n,is_read:true}))})); toast.success('All marked as read'); } catch { toast.error('Error'); } };
  const typeBg = {info:'#eff6ff',success:'#f0fdf4',warning:'#fffbeb',exam:'#f5f3ff'};
  return (
    <div className="page">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>Notifications</h1><p style={{color:'var(--text-2)',fontSize:13,marginTop:2}}>{data.unread_count>0?`${data.unread_count} unread`:'All caught up'}</p></div>
        {data.unread_count>0&&<button className="btn btn-ghost btn-sm" onClick={markAll}>✓ Mark all read</button>}
      </div>
      {loading?<div style={{textAlign:'center',paddingTop:60}}><Spinner lg/></div>
      :data.notifications.length===0?<div style={{textAlign:'center',paddingTop:80}}><div style={{fontSize:48,marginBottom:16}}>🔔</div><h3 style={{fontSize:17,color:'var(--text-2)'}}>No notifications yet</h3></div>
      :<div style={{display:'flex',flexDirection:'column',gap:10}}>
        {data.notifications.map(n=>(
          <div key={n.id} style={{background:n.is_read?'white':typeBg[n.type]||'#eff6ff',border:`1px solid ${n.is_read?'var(--border)':'var(--border-2)'}`,borderRadius:14,padding:'14px 18px',display:'flex',alignItems:'flex-start',gap:14,opacity:n.is_read?.72:1}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <span style={{fontSize:14,fontWeight:n.is_read?500:700,color:'var(--primary)'}}>{n.title}</span>
                {!n.is_read&&<span style={{width:8,height:8,borderRadius:'50%',background:'var(--primary-light)',flexShrink:0,display:'block'}}/>}
              </div>
              <p style={{fontSize:13,color:'var(--text-2)',marginTop:3}}>{n.message}</p>
              <span style={{fontSize:11,color:'var(--text-3)',marginTop:5,display:'block'}}>{new Date(n.created_at).toLocaleString()}</span>
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
  useEffect(()=>{const t=setInterval(()=>setAc(p=>(p+1)%CLASSES.length),1800);return()=>clearInterval(t);},[]);
  return (
    <div style={{background:'#0f0e23',color:'#e0e7ff',fontFamily:"'Plus Jakarta Sans',sans-serif",overflow:'hidden'}}>
      <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,borderBottom:'1px solid rgba(255,255,255,.06)',background:'rgba(15,14,35,.88)',backdropFilter:'blur(20px)',padding:'0 24px'}}>
        <div style={{maxWidth:1280,margin:'0 auto',height:66,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#4338ca,#f59e0b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🎓</div>
            <div><div style={{fontSize:15,fontWeight:800,color:'#e0e7ff'}}>GSS Gadau</div><div style={{fontSize:10,color:'#6b7280',letterSpacing:'1.2px',textTransform:'uppercase',marginTop:-2}}>Exam Portal</div></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Link to="/login" style={{padding:'8px 18px',borderRadius:10,border:'1px solid rgba(255,255,255,.12)',color:'#c7d2fe',fontSize:14,fontWeight:600}}>Sign In</Link>
            <Link to="/register" style={{padding:'8px 18px',borderRadius:10,background:'linear-gradient(135deg,#4338ca,#6366f1)',color:'white',fontSize:14,fontWeight:600,boxShadow:'0 2px 12px rgba(99,102,241,0.4)'}}>Get Started</Link>
          </div>
        </div>
      </nav>
      <section style={{minHeight:'100vh',display:'flex',alignItems:'center',position:'relative',paddingTop:80}}>
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',top:'8%',left:'3%',width:520,height:520,borderRadius:'50%',background:'radial-gradient(circle,rgba(99,102,241,.14) 0%,transparent 70%)',animation:'float 7s ease-in-out infinite'}}/>
          <div style={{position:'absolute',bottom:'8%',right:'3%',width:420,height:420,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,158,11,.11) 0%,transparent 70%)',animation:'float 9s ease-in-out infinite reverse'}}/>
          <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:.035}}><defs><pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0L0 0 0 48" fill="none" stroke="#c7d2fe" strokeWidth=".6"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
        </div>
        <div style={{maxWidth:1280,margin:'0 auto',padding:'60px 24px',position:'relative',zIndex:1,width:'100%'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:72,alignItems:'center'}}>
            <div style={{animation:'fadeUp .7s ease both'}}>
              <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'5px 13px',borderRadius:99,border:'1px solid rgba(99,102,241,.3)',background:'rgba(99,102,241,.1)',marginBottom:22}}>
                <span style={{fontSize:12,color:'#a5b4fc',fontWeight:600}}>⭐ Government Secondary School Gadau · Bauchi State</span>
              </div>
              <h1 style={{fontFamily:"'Fraunces',serif",fontSize:'clamp(40px,5vw,66px)',fontWeight:700,lineHeight:1.1,marginBottom:22,color:'#f0f4ff'}}>The Future of<br/><span style={{background:'linear-gradient(135deg,#6366f1,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>School Exams</span><br/>Is Here</h1>
              <p style={{fontSize:17,color:'#94a3b8',lineHeight:1.8,marginBottom:28,maxWidth:460}}>A comprehensive online examination platform built for GSS Gadau — secure, instant, and accessible for every class from JSS1 to SS3.</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:32}}>
                {CLASSES.map((cls,i)=>(
                  <span key={cls} onClick={()=>setAc(i)} style={{padding:'4px 13px',borderRadius:99,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .3s',background:i===ac?'rgba(99,102,241,.28)':'rgba(255,255,255,.04)',border:`1px solid ${i===ac?'rgba(99,102,241,.55)':'rgba(255,255,255,.07)'}`,color:i===ac?'#a5b4fc':'#6b7280'}}>{cls}</span>
                ))}
              </div>
              <div style={{display:'flex',gap:11,flexWrap:'wrap'}}>
                <Link to="/register" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'13px 28px',borderRadius:14,background:'linear-gradient(135deg,#4338ca,#6366f1)',color:'white',fontWeight:700,fontSize:15,boxShadow:'0 4px 20px rgba(99,102,241,.42)'}}>Start Your Journey →</Link>
                <Link to="/login" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'13px 28px',borderRadius:14,border:'1.5px solid rgba(255,255,255,.1)',color:'#c7d2fe',fontWeight:700,fontSize:15}}>Sign In ›</Link>
              </div>
            </div>
            <div style={{position:'relative',animation:'fadeUp .95s ease both'}}>
              <div style={{background:'rgba(26,24,54,.92)',border:'1px solid rgba(255,255,255,.08)',borderRadius:24,padding:26,boxShadow:'0 32px 80px rgba(0,0,0,.5)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                  <div><div style={{fontSize:11,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:3}}>Active Exam</div><div style={{fontSize:17,fontWeight:700,color:'#e0e7ff'}}>Mathematics — SS 2</div></div>
                  <div style={{padding:'5px 12px',borderRadius:99,background:'rgba(16,185,129,.14)',color:'#10b981',fontSize:11,fontWeight:700,border:'1px solid rgba(16,185,129,.3)',display:'flex',alignItems:'center',gap:5}}><span style={{width:5,height:5,borderRadius:'50%',background:'#10b981',display:'block',animation:'pulse 1.8s infinite'}}/>LIVE</div>
                </div>
                <div style={{background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.14)',borderRadius:12,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,color:'#6b7280',marginBottom:6}}>Question 3 of 20</div>
                  <div style={{fontSize:13,color:'#c7d2fe',lineHeight:1.65}}>What is the value of <em>x</em> in the equation: 3x + 12 = 27?</div>
                </div>
                {[['A','x = 3',false],['B','x = 5',true],['C','x = 7',false],['D','x = 9',false]].map(([l,t,c])=>(
                  <div key={l} style={{padding:'9px 13px',borderRadius:9,marginBottom:7,background:c?'rgba(16,185,129,.11)':'rgba(255,255,255,.025)',border:`1px solid ${c?'rgba(16,185,129,.28)':'rgba(255,255,255,.05)'}`,fontSize:13,color:c?'#10b981':'#94a3b8',fontWeight:c?600:400,display:'flex',alignItems:'center',gap:8}}>{c&&'✓ '}{l}. {t}</div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',marginTop:14,padding:'10px 14px',background:'rgba(245,158,11,.07)',borderRadius:9,border:'1px solid rgba(245,158,11,.14)'}}>
                  <span style={{fontSize:12,color:'#d97706',fontWeight:600}}>⏱ Time Remaining</span>
                  <span style={{fontSize:13,color:'#f59e0b',fontWeight:700}}>42:18</span>
                </div>
              </div>
              <div style={{position:'absolute',top:-22,right:-28,background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.28)',backdropFilter:'blur(14px)',borderRadius:14,padding:'12px 18px',animation:'float 4s ease-in-out infinite'}}>
                <div style={{fontSize:10,color:'#6b7280',marginBottom:3}}>Latest Score</div>
                <div style={{fontSize:26,fontWeight:800,color:'#10b981'}}>87%</div>
                <div style={{fontSize:10,color:'#059669',fontWeight:600}}>Grade A — Excellent</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section style={{padding:'56px 24px',borderTop:'1px solid rgba(255,255,255,.05)',background:'rgba(99,102,241,.04)'}}>
        <div style={{maxWidth:1280,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24}}>
          {[['2,400+','Students Enrolled'],['180+','Exams Conducted'],['98%','Pass Rate'],['24/7','System Uptime']].map(([v,l])=>(
            <div key={l} style={{textAlign:'center'}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:34,fontWeight:700,color:'#f0f4ff',letterSpacing:'-1px'}}>{v}</div>
              <div style={{fontSize:12,color:'#6b7280',marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{padding:'80px 24px',background:'rgba(26,24,54,.45)'}}>
        <div style={{maxWidth:900,margin:'0 auto',textAlign:'center'}}>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:40,fontWeight:700,color:'#f0f4ff',marginBottom:12}}>How It Works</h2>
          <p style={{fontSize:15,color:'#64748b',marginBottom:56}}>Three simple steps — from registration to results</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:36}}>
            {[['01','Create Account','Register with your student ID. Teachers and admins can also self-register.','#6366f1'],['02','Take the Exam','Log in, open your available exam and start. The countdown timer runs automatically.','#f59e0b'],['03','See Your Score','Submit and instantly view your score, grade and correct answers with explanations.','#10b981']].map(([n,t,d,c])=>(
              <div key={n} style={{textAlign:'center'}}>
                <div style={{width:54,height:54,borderRadius:15,background:`${c}18`,border:`2px solid ${c}40`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px',fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:700,color:c}}>{n}</div>
                <h3 style={{fontSize:17,fontWeight:700,color:'#e0e7ff',marginBottom:9}}>{t}</h3>
                <p style={{fontSize:13,color:'#64748b',lineHeight:1.75}}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section style={{padding:'96px 24px',textAlign:'center'}}>
        <div style={{maxWidth:640,margin:'0 auto'}}>
          <div style={{width:68,height:68,borderRadius:19,background:'linear-gradient(135deg,#4338ca,#f59e0b)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 22px',fontSize:30}}>🎓</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:46,fontWeight:700,color:'#f0f4ff',marginBottom:14,lineHeight:1.15}}>Ready to Excel?</h2>
          <p style={{fontSize:16,color:'#64748b',marginBottom:36,lineHeight:1.8}}>Join thousands of GSS Gadau students and teachers on the platform built to transform how we assess learning.</p>
          <div style={{display:'flex',gap:11,justifyContent:'center',flexWrap:'wrap',marginBottom:28}}>
            <Link to="/register" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 30px',borderRadius:14,background:'linear-gradient(135deg,#4338ca,#6366f1)',color:'white',fontWeight:700,fontSize:15,boxShadow:'0 4px 24px rgba(99,102,241,.5)'}}>Register Now →</Link>
            <Link to="/login" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 30px',borderRadius:14,border:'1.5px solid rgba(255,255,255,.1)',color:'#c7d2fe',fontWeight:700,fontSize:15}}>Admin Login</Link>
          </div>
          <div style={{fontSize:12,color:'#374151',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:10,padding:'10px 18px',display:'inline-block'}}>
            Default admin — <code style={{color:'#818cf8'}}>admin@gssgadau.edu.ng</code> &nbsp;/&nbsp; <code style={{color:'#818cf8'}}>Admin@2024</code>
          </div>
        </div>
      </section>
      <footer style={{borderTop:'1px solid rgba(255,255,255,.05)',padding:'36px 24px',textAlign:'center'}}>
        <p style={{fontSize:12,color:'#374151'}}>© 2024 Government Secondary School Gadau, Bauchi State, Nigeria. All rights reserved.</p>
      </footer>
    </div>
  );
}

// ─── AUTH PAGES ───────────────────────────────────────────────────────────────
const SUBJECTS=['Mathematics','English Language','Physics','Chemistry','Biology','Geography','History','Civic Education','Agricultural Science','Economics','Government','Literature','Further Mathematics','Technical Drawing','Computer Science'];
function AuthShell({ title, sub, children }) {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#f8f7ff 0%,#eef2ff 100%)',padding:'24px 16px'}}>
      <div style={{width:'100%',maxWidth:480}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <Link to="/" style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <div style={{width:52,height:52,borderRadius:15,background:'linear-gradient(135deg,#4338ca,#f59e0b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,boxShadow:'0 6px 20px rgba(67,56,202,.35)'}}>🎓</div>
            <span style={{fontSize:13,fontWeight:700,color:'#4338ca',letterSpacing:'.3px'}}>GSS Gadau Exam Portal</span>
          </Link>
          <h1 style={{marginTop:16,fontSize:26,fontWeight:800,color:'#1e1b4b'}}>{title}</h1>
          <p style={{fontSize:14,color:'#6b7280',marginTop:4}}>{sub}</p>
        </div>
        <div style={{background:'white',borderRadius:24,padding:32,boxShadow:'0 8px 40px rgba(30,27,75,.1)',border:'1px solid #e0e7ff'}}>{children}</div>
      </div>
    </div>
  );
}
function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const [form, setForm] = useState({email:'',password:''});
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const handle = async e => {
    e.preventDefault(); setLoading(true);
    try { const u = await login(form.email, form.password); toast.success(`Welcome back, ${u.full_name.split(' ')[0]}!`); nav(u.role==='admin'?'/admin':u.role==='teacher'?'/teacher':'/student'); }
    catch(e) { toast.error(e.message||'Login failed'); }
    finally { setLoading(false); }
  };
  return (
    <AuthShell title="Welcome Back" sub="Sign in to your account">
      <form onSubmit={handle} style={{display:'flex',flexDirection:'column',gap:18}}>
        <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" placeholder="you@gssgadau.edu.ng" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Password</label>
          <div style={{position:'relative'}}>
            <input className="form-input" type={show?'text':'password'} placeholder="Enter password" required style={{paddingRight:42}} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
            <button type="button" onClick={()=>setShow(!show)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',color:'#9ca3af'}}>{show?'🙈':'👁'}</button>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{justifyContent:'center',marginTop:4}}>{loading?<><Spinner/> Signing in…</>:'Sign In'}</button>
      </form>
      <p style={{textAlign:'center',marginTop:20,fontSize:14,color:'#6b7280'}}>Don't have an account? <Link to="/register" style={{color:'#4338ca',fontWeight:600}}>Register here</Link></p>
      <div style={{marginTop:20,padding:14,background:'#f8f7ff',borderRadius:12,border:'1px solid #e0e7ff',fontSize:12,color:'#6b7280',textAlign:'center'}}>Admin demo: <strong style={{color:'#4338ca'}}>admin@gssgadau.edu.ng</strong> / <strong style={{color:'#4338ca'}}>Admin@2024</strong></div>
    </AuthShell>
  );
}
function Register() {
  const { register } = useAuth(); const nav = useNavigate();
  const [form, setForm] = useState({full_name:'',email:'',password:'',role:'student',class:'',student_id:'',subject_specialization:''});
  const [show, setShow] = useState(false); const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handle = async e => {
    e.preventDefault();
    if (form.password.length<6) return toast.error('Password must be at least 6 characters');
    if (form.role==='student'&&!form.class) return toast.error('Please select your class');
    setLoading(true);
    try { const u = await register(form); toast.success('Account created! Welcome 🎉'); nav(u.role==='admin'?'/admin':u.role==='teacher'?'/teacher':'/student'); }
    catch(e) { toast.error(e.message||'Registration failed'); }
    finally { setLoading(false); }
  };
  return (
    <AuthShell title="Create Account" sub="Join the GSS Gadau Exam Portal">
      <form onSubmit={handle} style={{display:'flex',flexDirection:'column',gap:16}}>
        <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" placeholder="e.g. Aisha Suleiman" required value={form.full_name} onChange={e=>set('full_name',e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" placeholder="email@example.com" required value={form.email} onChange={e=>set('email',e.target.value)}/></div>
        <div className="form-group"><label className="form-label">I am a…</label><select className="form-input form-select" value={form.role} onChange={e=>set('role',e.target.value)}><option value="student">Student</option><option value="teacher">Teacher</option></select></div>
        {form.role==='student'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div className="form-group"><label className="form-label">Class</label><select className="form-input form-select" value={form.class} onChange={e=>set('class',e.target.value)} required><option value="">Select class</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Student ID <span style={{color:'#9ca3af',fontWeight:400}}>(optional)</span></label><input className="form-input" placeholder="e.g. GSS/24/001" value={form.student_id} onChange={e=>set('student_id',e.target.value)}/></div>
        </div>}
        {form.role==='teacher'&&<div className="form-group"><label className="form-label">Subject Specialisation</label><select className="form-input form-select" value={form.subject_specialization} onChange={e=>set('subject_specialization',e.target.value)}><option value="">Select subject</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>}
        <div className="form-group"><label className="form-label">Password</label>
          <div style={{position:'relative'}}>
            <input className="form-input" type={show?'text':'password'} placeholder="Min. 6 characters" required style={{paddingRight:42}} value={form.password} onChange={e=>set('password',e.target.value)}/>
            <button type="button" onClick={()=>setShow(!show)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',color:'#9ca3af'}}>{show?'🙈':'👁'}</button>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{justifyContent:'center',marginTop:4}}>{loading?<><Spinner/> Creating account…</>:'Create Account'}</button>
      </form>
      <p style={{textAlign:'center',marginTop:18,fontSize:14,color:'#6b7280'}}>Already have an account? <Link to="/login" style={{color:'#4338ca',fontWeight:600}}>Sign in</Link></p>
    </AuthShell>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
const ADMIN_NAV=[{to:'/admin',icon:'🏠',label:'Dashboard',end:true},{to:'/admin/users',icon:'👥',label:'Users'},{to:'/admin/subjects',icon:'📚',label:'Subjects'},{to:'/admin/exams',icon:'📄',label:'Exams'},{to:'/admin/results',icon:'📊',label:'Results'},{to:'/admin/announce',icon:'📢',label:'Announce'},{to:'/admin/notifications',icon:'🔔',label:'Notifications'}];
function AdminDashboard() {
  return <Layout nav={ADMIN_NAV}><Routes>
    <Route index element={<AdminHome/>}/>
    <Route path="users" element={<AdminUsers/>}/>
    <Route path="subjects" element={<AdminSubjects/>}/>
    <Route path="exams" element={<AdminExams/>}/>
    <Route path="results" element={<AdminResults/>}/>
    <Route path="announce" element={<AdminAnnounce/>}/>
    <Route path="notifications" element={<Notifications/>}/>
  </Routes></Layout>;
}
function AdminHome() {
  const [stats,setStats]=useState(null); const [results,setResults]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ Promise.all([api.get('/admin-stats'),api.get('/admin-results')]).then(([s,r])=>{ setStats(s); setResults(r.slice(0,8)); }).finally(()=>setLoading(false)); },[]);
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300}}><Spinner lg/></div>;
  const gc=g=>g==='A'||g==='B'?'#10b981':g==='F'?'#f43f5e':'#f59e0b';
  const CARDS=[['Total Users',stats?.users.total||0,'#6366f1'],['Students',stats?.users.student||0,'#10b981'],['Total Exams',stats?.exams.total||0,'#f59e0b'],['Avg Score',`${stats?.attempts.avg_score||0}%`,'#0ea5e9'],['Subjects',stats?.subjects||0,'#8b5cf6'],['Submissions',stats?.attempts.total||0,'#ec4899']];
  return (
    <div className="page">
      <div style={{marginBottom:24}}><h1 style={{fontSize:24,fontWeight:800,color:'var(--primary)'}}>Admin Dashboard</h1><p style={{color:'var(--text-2)',fontSize:14,marginTop:3}}>Overview of GSS Gadau Examination System</p></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:28}}>
        {CARDS.map(([l,v,c])=>(
          <div key={l} className="stat-card"><p style={{fontSize:12,color:'var(--text-2)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>{l}</p><p style={{fontSize:28,fontWeight:800,color:c}}>{v}</p></div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16,marginBottom:28}}>
        <div className="card"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14,color:'var(--primary)'}}>Exam Status</h3>{[['Draft',stats?.exams.draft||0,'#9ca3af'],['Published',stats?.exams.published||0,'#3b82f6'],['Active',stats?.exams.active||0,'#10b981'],['Completed',stats?.exams.completed||0,'#8b5cf6']].map(([l,v,c])=>(
          <div key={l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <span style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',background:c,display:'block'}}/><span style={{fontSize:14,color:'var(--text-2)'}}>{l}</span></span>
            <strong style={{color:c,fontSize:16}}>{v}</strong>
          </div>
        ))}</div>
        <div className="card"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14,color:'var(--primary)'}}>User Breakdown</h3>{[['Admins',stats?.users.admin||0,'#f43f5e'],['Teachers',stats?.users.teacher||0,'#6366f1'],['Students',stats?.users.student||0,'#10b981']].map(([l,v,c])=>(
          <div key={l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <span style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',background:c,display:'block'}}/><span style={{fontSize:14,color:'var(--text-2)'}}>{l}</span></span>
            <strong style={{color:c,fontSize:16}}>{v}</strong>
          </div>
        ))}</div>
      </div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:700,color:'var(--primary)'}}>Recent Submissions</h3><Link to="/admin/results" style={{fontSize:13,color:'var(--primary-light)',fontWeight:600}}>View all →</Link></div>
        <div className="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Exam</th><th>Score</th><th>Grade</th><th>Date</th></tr></thead><tbody>
          {results.map(r=>(<tr key={r.id}><td style={{fontWeight:600}}>{r.student_name}</td><td>{r.class}</td><td style={{color:'var(--text-2)'}}>{r.exam_title}</td><td><strong>{r.score}/{r.total_marks}</strong> <span style={{color:'var(--text-3)',fontSize:12}}>({parseFloat(r.percentage).toFixed(0)}%)</span></td><td><span style={{fontWeight:700,color:gc(r.grade)}}>{r.grade}</span></td><td style={{color:'var(--text-3)',fontSize:12}}>{new Date(r.submitted_at).toLocaleDateString()}</td></tr>))}
          {!results.length&&<tr><td colSpan={6} style={{textAlign:'center',color:'var(--text-3)',padding:32}}>No submissions yet</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
function AdminUsers() {
  const [users,setUsers]=useState([]); const [total,setTotal]=useState(0); const [search,setSearch]=useState(''); const [roleF,setRoleF]=useState(''); const [modal,setModal]=useState(null); const [form,setForm]=useState({}); const [saving,setSaving]=useState(false); const [loading,setLoading]=useState(true);
  const EMPTY={full_name:'',email:'',password:'',role:'student',class:'',student_id:'',subject_specialization:''};
  const load=async()=>{ setLoading(true); try{const d=await api.get(`/admin-users?role=${roleF}&search=${search}`); setUsers(d.users); setTotal(d.total);}finally{setLoading(false);} };
  useEffect(()=>{ load(); },[roleF,search]);
  const save=async e=>{ e.preventDefault(); setSaving(true); try{
    if(modal==='create'){const d=await api.post('/admin-users',form);setUsers(p=>[d,...p]);toast.success('User created');}
    else{const d=await api.put(`/admin-users?id=${modal.id}`,form);setUsers(p=>p.map(u=>u.id===d.id?{...u,...d}:u));toast.success('Updated');}
    setModal(null);}catch(e){toast.error(e.message);}finally{setSaving(false);} };
  const toggle=async u=>{ try{await api.put(`/admin-users?id=${u.id}`,{is_active:!u.is_active});setUsers(p=>p.map(x=>x.id===u.id?{...x,is_active:!x.is_active}:x));toast.success(u.is_active?'Deactivated':'Activated');}catch{toast.error('Error');} };
  return (
    <div className="page">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>Users</h1><p style={{color:'var(--text-2)',fontSize:13,marginTop:2}}>{total} total users</p></div>
        <button className="btn btn-primary" onClick={()=>{setForm(EMPTY);setModal('create');}}>+ Add User</button>
      </div>
      <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap'}}>
        <input className="form-input" placeholder="🔍 Search name or email…" style={{flex:'1 1 220px'}} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="form-input form-select" style={{width:140}} value={roleF} onChange={e=>setRoleF(e.target.value)}><option value="">All roles</option>{['student','teacher','admin'].map(r=><option key={r} value={r}>{r}</option>)}</select>
      </div>
      <div className="card" style={{padding:0}}><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Class / Subject</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {loading?<tr><td colSpan={6} style={{textAlign:'center',padding:40}}><Spinner/></td></tr>
        :users.map(u=>(
          <tr key={u.id}>
            <td><div style={{display:'flex',alignItems:'center',gap:9}}><div style={{width:30,height:30,borderRadius:99,background:u.avatar_color||'#6366f1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>{u.full_name.split(' ').slice(0,2).map(w=>w[0]).join('')}</div><span style={{fontWeight:600,fontSize:13}}>{u.full_name}</span></div></td>
            <td style={{color:'var(--text-2)',fontSize:13}}>{u.email}</td>
            <td><span className={`badge badge-${u.role==='admin'?'danger':u.role==='teacher'?'published':'success'}`} style={{textTransform:'capitalize'}}>{u.role}</span></td>
            <td style={{color:'var(--text-2)',fontSize:13}}>{u.class||u.subject_specialization||'—'}</td>
            <td><span className={`badge badge-${u.is_active?'success':'archived'}`}>{u.is_active?'Active':'Inactive'}</span></td>
            <td><div style={{display:'flex',gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>{setForm({...u,password:''});setModal(u);}}>✏️</button><button className={`btn btn-sm ${u.is_active?'btn-danger':'btn-success'}`} onClick={()=>toggle(u)}>{u.is_active?'🚫':'✅'}</button></div></td>
          </tr>))}
        {!loading&&!users.length&&<tr><td colSpan={6} style={{textAlign:'center',color:'var(--text-3)',padding:40}}>No users found</td></tr>}
      </tbody></table></div></div>
      {modal&&<Modal title={modal==='create'?'Add New User':'Edit User'} onClose={()=>setModal(null)}>
        <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" required value={form.full_name||''} onChange={e=>setForm({...form,full_name:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" required value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group"><label className="form-label">Role</label><select className="form-input form-select" value={form.role||'student'} onChange={e=>setForm({...form,role:e.target.value})}>{['student','teacher','admin'].map(r=><option key={r} value={r}>{r}</option>)}</select></div>
            {form.role==='student'&&<div className="form-group"><label className="form-label">Class</label><select className="form-input form-select" value={form.class||''} onChange={e=>setForm({...form,class:e.target.value})}><option value="">Select</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>}
          </div>
          {modal==='create'&&<div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" placeholder="Leave blank for Password@123" value={form.password||''} onChange={e=>setForm({...form,password:e.target.value})}/></div>}
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:6}}><button type="button" className="btn btn-ghost" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?<Spinner/>:modal==='create'?'Create':'Save'}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
function AdminSubjects() {
  const [subjects,setSubjects]=useState([]); const [teachers,setTeachers]=useState([]); const [modal,setModal]=useState(null); const [form,setForm]=useState({name:'',code:'',class_level:'',teacher_id:'',description:''}); const [saving,setSaving]=useState(false);
  useEffect(()=>{ api.get('/admin-subjects').then(r=>setSubjects(r)); api.get('/admin-users?role=teacher').then(r=>setTeachers(r.users)); },[]);
  const save=async e=>{ e.preventDefault();setSaving(true);try{
    if(modal==='new'){const d=await api.post('/admin-subjects',form);setSubjects(p=>[d,...p]);toast.success('Created');}
    else{const d=await api.put(`/admin-subjects?id=${modal.id}`,form);setSubjects(p=>p.map(s=>s.id===d.id?d:s));toast.success('Updated');}
    setModal(null);}catch(e){toast.error(e.message);}finally{setSaving(false);} };
  const del=async id=>{ if(!window.confirm('Delete subject?'))return; try{await api.delete(`/admin-subjects?id=${id}`);setSubjects(p=>p.filter(s=>s.id!==id));toast.success('Deleted');}catch{toast.error('Cannot delete — exams may depend on it');} };
  return (
    <div className="page">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>Subjects</h1><p style={{color:'var(--text-2)',fontSize:13,marginTop:2}}>{subjects.length} subjects</p></div>
        <button className="btn btn-primary" onClick={()=>{setForm({name:'',code:'',class_level:'',teacher_id:'',description:''});setModal('new');}}>+ Add Subject</button>
      </div>
      <div className="card" style={{padding:0}}><div className="table-wrap"><table><thead><tr><th>Subject</th><th>Code</th><th>Class</th><th>Teacher</th><th>Actions</th></tr></thead><tbody>
        {subjects.map(s=>(
          <tr key={s.id}>
            <td style={{fontWeight:600}}>{s.name}</td>
            <td><code style={{background:'var(--bg-subtle)',padding:'2px 7px',borderRadius:5,fontSize:12}}>{s.code}</code></td>
            <td>{s.class_level}</td>
            <td style={{color:'var(--text-2)',fontSize:13}}>{s.teacher_name||'Unassigned'}</td>
            <td><div style={{display:'flex',gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>{setForm({name:s.name,code:s.code,class_level:s.class_level,teacher_id:s.teacher_id||'',description:s.description||''});setModal(s);}}>✏️</button><button className="btn btn-danger btn-sm" onClick={()=>del(s.id)}>🗑</button></div></td>
          </tr>))}
        {!subjects.length&&<tr><td colSpan={5} style={{textAlign:'center',color:'var(--text-3)',padding:40}}>No subjects yet</td></tr>}
      </tbody></table></div></div>
      {modal&&<Modal title={modal==='new'?'Add Subject':'Edit Subject'} onClose={()=>setModal(null)}>
        <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group"><label className="form-label">Name</label><input className="form-input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div className="form-group"><label className="form-label">Code</label><input className="form-input" required placeholder="e.g. MATH" value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group"><label className="form-label">Class Level</label><select className="form-input form-select" required value={form.class_level} onChange={e=>setForm({...form,class_level:e.target.value})}><option value="">Select</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Teacher</label><select className="form-input form-select" value={form.teacher_id} onChange={e=>setForm({...form,teacher_id:e.target.value})}><option value="">None</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button type="button" className="btn btn-ghost" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?<Spinner/>:modal==='new'?'Create':'Save'}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
function AdminExams() {
  const [exams,setExams]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/exams').then(r=>setExams(r)).finally(()=>setLoading(false)); },[]);
  const del=async id=>{ if(!window.confirm('Delete this exam and all its questions?'))return; try{await api.delete(`/exams?id=${id}`);setExams(p=>p.filter(e=>e.id!==id));toast.success('Deleted');}catch{toast.error('Error');} };
  return (
    <div className="page">
      <div style={{marginBottom:22}}><h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>All Exams</h1><p style={{color:'var(--text-2)',fontSize:13,marginTop:2}}>{exams.length} exams</p></div>
      <div className="card" style={{padding:0}}><div className="table-wrap"><table><thead><tr><th>Title</th><th>Subject</th><th>Class</th><th>Teacher</th><th>Questions</th><th>Submissions</th><th>Status</th><th></th></tr></thead><tbody>
        {loading?<tr><td colSpan={8} style={{textAlign:'center',padding:40}}><Spinner/></td></tr>
        :exams.map(e=>(
          <tr key={e.id}>
            <td style={{fontWeight:600}}><div style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.title}</div></td>
            <td style={{color:'var(--text-2)',fontSize:13}}>{e.subject_name||'—'}</td>
            <td>{e.class_level}</td>
            <td style={{color:'var(--text-2)',fontSize:13}}>{e.teacher_name||'—'}</td>
            <td style={{textAlign:'center'}}>{e.question_count||0}</td>
            <td style={{textAlign:'center'}}>{e.submissions||0}</td>
            <td><StatusBadge s={e.status}/></td>
            <td><button className="btn btn-danger btn-sm" onClick={()=>del(e.id)}>🗑</button></td>
          </tr>))}
        {!loading&&!exams.length&&<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-3)',padding:40}}>No exams yet</td></tr>}
      </tbody></table></div></div>
    </div>
  );
}
function AdminResults() {
  const [results,setResults]=useState([]); const [search,setSearch]=useState(''); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/admin-results').then(r=>setResults(r)).finally(()=>setLoading(false)); },[]);
  const filtered=results.filter(r=>!search||r.student_name?.toLowerCase().includes(search.toLowerCase())||r.exam_title?.toLowerCase().includes(search.toLowerCase()));
  const gc=g=>g==='A'||g==='B'?'#10b981':g==='F'?'#f43f5e':'#f59e0b';
  return (
    <div className="page">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>Exam Results</h1><p style={{color:'var(--text-2)',fontSize:13,marginTop:2}}>{results.length} submissions</p></div>
        <input className="form-input" placeholder="🔍 Search…" style={{width:240}} value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="card" style={{padding:0}}><div className="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Exam</th><th>Score</th><th>%</th><th>Grade</th><th>Time</th><th>Date</th></tr></thead><tbody>
        {loading?<tr><td colSpan={8} style={{textAlign:'center',padding:40}}><Spinner/></td></tr>
        :filtered.map(r=>(
          <tr key={r.id}>
            <td style={{fontWeight:600,fontSize:13}}>{r.student_name}</td><td style={{fontSize:12}}>{r.class}</td>
            <td style={{color:'var(--text-2)',fontSize:12}}><div style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.exam_title}</div></td>
            <td style={{fontWeight:700}}>{r.score}/{r.total_marks}</td>
            <td style={{fontWeight:600,color:gc(r.grade)}}>{parseFloat(r.percentage).toFixed(1)}%</td>
            <td><strong style={{color:gc(r.grade)}}>{r.grade}</strong></td>
            <td style={{color:'var(--text-3)',fontSize:12}}>{r.time_taken_minutes}m</td>
            <td style={{color:'var(--text-3)',fontSize:12}}>{new Date(r.submitted_at).toLocaleDateString()}</td>
          </tr>))}
        {!loading&&!filtered.length&&<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-3)',padding:40}}>No results found</td></tr>}
      </tbody></table></div></div>
    </div>
  );
}
function AdminAnnounce() {
  const { user } = useAuth();
  const [ann,setAnn]=useState([]); const [form,setForm]=useState({title:'',content:'',target_role:'',is_pinned:false}); const [saving,setSaving]=useState(false);
  useEffect(()=>{ api.get('/admin-announce').then(r=>setAnn(r)); },[]);
  const submit=async e=>{ e.preventDefault();setSaving(true);try{const d=await api.post('/admin-announce',form);setAnn(p=>[d,...p]);setForm({title:'',content:'',target_role:'',is_pinned:false});toast.success('Announcement posted');}catch(e){toast.error(e.message);}finally{setSaving(false);} };
  return (
    <div className="page">
      <div style={{marginBottom:22}}><h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>Announcements</h1></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div className="card">
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16,color:'var(--primary)'}}>Post Announcement</h3>
          <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="form-group"><label className="form-label">Title</label><input className="form-input" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
            <div className="form-group"><label className="form-label">Content</label><textarea className="form-input" required rows={4} value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="form-group"><label className="form-label">Target Role</label><select className="form-input form-select" value={form.target_role} onChange={e=>setForm({...form,target_role:e.target.value})}><option value="">All users</option><option value="student">Students</option><option value="teacher">Teachers</option></select></div>
              <div className="form-group" style={{justifyContent:'flex-end'}}><label className="form-label">Pin?</label><label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" checked={form.is_pinned} onChange={e=>setForm({...form,is_pinned:e.target.checked})}/> Pin to top</label></div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?<Spinner/>:'📢 Post Announcement'}</button>
          </form>
        </div>
        <div className="card" style={{padding:0,overflowY:'auto',maxHeight:500}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)'}}><h3 style={{fontSize:15,fontWeight:700,color:'var(--primary)'}}>Posted ({ann.length})</h3></div>
          {ann.map(a=>(
            <div key={a.id} style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
              {a.is_pinned&&<div style={{fontSize:10,color:'#b45309',fontWeight:700,marginBottom:3}}>📌 PINNED</div>}
              <div style={{fontSize:14,fontWeight:600,color:'var(--primary)',marginBottom:3}}>{a.title}</div>
              <div style={{fontSize:12,color:'var(--text-3)'}}>{a.target_role?`For ${a.title} only`:'All users'} · {new Date(a.created_at).toLocaleDateString()}</div>
            </div>
          ))}
          {!ann.length&&<div style={{padding:40,textAlign:'center',color:'var(--text-3)',fontSize:13}}>No announcements yet</div>}
        </div>
      </div>
    </div>
  );
}

// ─── TEACHER ──────────────────────────────────────────────────────────────────
const TEACHER_NAV=[{to:'/teacher',icon:'🏠',label:'Dashboard',end:true},{to:'/teacher/exams',icon:'📄',label:'My Exams'},{to:'/teacher/notifications',icon:'🔔',label:'Notifications'}];
function TeacherDashboard() {
  return <Layout nav={TEACHER_NAV}><Routes>
    <Route index element={<TeacherHome/>}/>
    <Route path="exams" element={<TeacherExams/>}/>
    <Route path="exams/new" element={<ExamEditor/>}/>
    <Route path="exams/:id" element={<ExamEditor/>}/>
    <Route path="exams/:id/results" element={<ExamResults/>}/>
    <Route path="notifications" element={<Notifications/>}/>
  </Routes></Layout>;
}
function TeacherHome() {
  const { user } = useAuth();
  const [exams,setExams]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/exams').then(r=>setExams(r)).finally(()=>setLoading(false)); },[]);
  const gc=g=>g==='A'||g==='B'?'#10b981':g==='F'?'#f43f5e':'#f59e0b';
  const total=exams.length; const active=exams.filter(e=>e.status==='active').length; const subs=exams.reduce((a,e)=>a+(+e.submissions||0),0);
  return (
    <div className="page">
      <h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)',marginBottom:4}}>Hello, {user?.full_name?.split(' ')[0]} 👋</h1>
      <p style={{color:'var(--text-2)',fontSize:14,marginBottom:24}}>Teacher Dashboard</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
        {[['My Exams',total,'#6366f1'],['Active Exams',active,'#10b981'],['Total Submissions',subs,'#f59e0b']].map(([l,v,c])=>(
          <div key={l} className="stat-card"><p style={{fontSize:11,color:'var(--text-2)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:5}}>{l}</p><p style={{fontSize:26,fontWeight:800,color:c}}>{v}</p></div>
        ))}
      </div>
      <div className="card" style={{padding:0}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h3 style={{fontSize:15,fontWeight:700,color:'var(--primary)'}}>Recent Exams</h3>
          <Link to="/teacher/exams/new" className="btn btn-primary btn-sm">+ New Exam</Link>
        </div>
        {loading?<div style={{padding:40,textAlign:'center'}}><Spinner/></div>:
        <div style={{padding:'0 20px'}}>
          {exams.slice(0,6).map(e=>(
            <div key={e.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
              <div><div style={{fontSize:14,fontWeight:600,color:'var(--primary)'}}>{e.title}</div><div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{e.subject_name} · {e.class_level} · {e.question_count||0} questions</div></div>
              <div style={{display:'flex',alignItems:'center',gap:10}}><StatusBadge s={e.status}/><Link to={`/teacher/exams/${e.id}`} style={{fontSize:12,color:'var(--primary-light)',fontWeight:600}}>Edit →</Link></div>
            </div>
          ))}
          {!exams.length&&<p style={{color:'var(--text-3)',textAlign:'center',padding:32,fontSize:13}}>No exams yet. <Link to="/teacher/exams/new" style={{color:'var(--primary-light)',fontWeight:600}}>Create your first exam →</Link></p>}
        </div>}
      </div>
    </div>
  );
}
function TeacherExams() {
  const [exams,setExams]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/exams').then(r=>setExams(r)).finally(()=>setLoading(false)); },[]);
  const publish=async id=>{ try{await api.post(`/exams?id=${id}&action=publish`);setExams(p=>p.map(e=>e.id===id?{...e,status:'published'}:e));toast.success('Exam published!');}catch(e){toast.error(e.message);} };
  return (
    <div className="page">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>My Exams</h1><p style={{color:'var(--text-2)',fontSize:13,marginTop:2}}>{exams.length} exams</p></div>
        <Link to="/teacher/exams/new" className="btn btn-primary">+ New Exam</Link>
      </div>
      {loading?<div style={{textAlign:'center',paddingTop:80}}><Spinner lg/></div>:
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {exams.map(e=>(
          <div key={e.id} className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}><StatusBadge s={e.status}/><span style={{fontSize:12,color:'var(--text-3)'}}>{e.submissions||0} submissions</span></div>
            <h3 style={{fontSize:16,fontWeight:700,color:'var(--primary)',marginBottom:4}}>{e.title}</h3>
            <p style={{fontSize:12,color:'var(--text-3)',marginBottom:14}}>{e.subject_name||'General'} · {e.class_level}</p>
            <div style={{display:'flex',gap:14,fontSize:12,color:'var(--text-3)',marginBottom:16}}><span>📋 {e.question_count||0} questions</span><span>⏱ {e.duration_minutes}min</span></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <Link to={`/teacher/exams/${e.id}`} className="btn btn-ghost btn-sm">✏️ Edit</Link>
              {e.status==='draft'&&+e.question_count>0&&<button className="btn btn-primary btn-sm" onClick={()=>publish(e.id)}>🚀 Publish</button>}
              {e.submissions>0&&<Link to={`/teacher/exams/${e.id}/results`} className="btn btn-success btn-sm">📊 Results</Link>}
            </div>
          </div>))}
        {!exams.length&&<div style={{gridColumn:'1/-1',textAlign:'center',paddingTop:60,color:'var(--text-3)'}}>No exams yet. <Link to="/teacher/exams/new" style={{color:'var(--primary-light)',fontWeight:600}}>Create your first →</Link></div>}
      </div>}
    </div>
  );
}
function ExamEditor() {
  const { id } = useParams(); const nav = useNavigate(); const isEdit=!!id;
  const EFORM={title:'',subject_id:'',class_level:'',instructions:'',duration_minutes:60,pass_mark:50,show_results_immediately:true,max_attempts:1,randomize_questions:false};
  const QFORM={question_text:'',question_type:'mcq',options:['','','',''],correct_answer:'',marks:1,explanation:''};
  const [form,setForm]=useState(EFORM); const [questions,setQuestions]=useState([]); const [subjects,setSubjects]=useState([]); const [saving,setSaving]=useState(false); const [loading,setLoading]=useState(!!id);
  const [qModal,setQModal]=useState(null); const [qForm,setQForm]=useState(QFORM); const [qSaving,setQSaving]=useState(false);
  useEffect(()=>{ api.get('/subjects').then(r=>setSubjects(r)); if(id){api.get(`/exams?id=${id}`).then(r=>{setForm({...EFORM,...r});setQuestions(r.questions||[]);}).finally(()=>setLoading(false));}else{setLoading(false);} },[id]);
  const saveExam=async e=>{ e.preventDefault();setSaving(true);try{
    if(isEdit){const d=await api.put(`/exams?id=${id}`,form);toast.success('Exam saved');}
    else{const d=await api.post('/exams',form);toast.success('Exam created');nav(`/teacher/exams/${d.id}`);}
  }catch(e){toast.error(e.message);}finally{setSaving(false);} };
  const publish=async()=>{ try{await api.post(`/exams?id=${id}&action=publish`);setForm(f=>({...f,status:'published'}));toast.success('Exam published!');}catch(e){toast.error(e.message);} };
  const openQ=(q=null)=>{ setQForm(q?{question_text:q.question_text,question_type:q.question_type,options:Array.isArray(q.options)?q.options:JSON.parse(q.options||'[]'),correct_answer:q.correct_answer,marks:q.marks,explanation:q.explanation||''}:{...QFORM,options:['','','','']});setQModal(q||'new'); };
  const saveQ=async e=>{ e.preventDefault();if(qForm.question_type==='mcq'&&!qForm.correct_answer)return toast.error('Select the correct option');setQSaving(true);
    try{
      if(qModal==='new'){const d=await api.post(`/exams?id=${id}&action=questions`,{...qForm,options:qForm.question_type==='mcq'?qForm.options:null});setQuestions(p=>[...p,d]);}
      else{const d=await api.put(`/exams?id=${qModal.id}&action=questions&qid=${qModal.id}`,{...qForm,options:qForm.question_type==='mcq'?qForm.options:null});setQuestions(p=>p.map(q=>q.id===d.id?d:q));}
      setQModal(null);toast.success('Question saved');
    }catch(e){toast.error(e.message);}finally{setQSaving(false);} };
  const delQ=async qid=>{ if(!window.confirm('Delete question?'))return; try{await api.delete(`/exams?id=${id}&action=questions&qid=${qid}`);setQuestions(p=>p.filter(q=>q.id!==qid));toast.success('Deleted');}catch{toast.error('Error');} };
  if(loading) return <div style={{textAlign:'center',paddingTop:100}}><Spinner lg/></div>;
  return (
    <div className="page">
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:22}}>
        <Link to="/teacher/exams" style={{fontSize:13,color:'var(--text-2)'}}>← Back</Link>
        <h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>{isEdit?'Edit Exam':'New Exam'}</h1>
        {isEdit&&form.status&&<StatusBadge s={form.status}/>}
        {isEdit&&form.status==='draft'&&questions.length>0&&<button className="btn btn-primary btn-sm" onClick={publish}>🚀 Publish</button>}
      </div>
      <div className="card" style={{marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:16,color:'var(--primary)'}}>Exam Details</h3>
        <form onSubmit={saveExam} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group"><label className="form-label">Title</label><input className="form-input" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            <div className="form-group"><label className="form-label">Subject</label><select className="form-input form-select" value={form.subject_id||''} onChange={e=>setForm({...form,subject_id:e.target.value})}><option value="">None</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Class Level</label><select className="form-input form-select" required value={form.class_level||''} onChange={e=>setForm({...form,class_level:e.target.value})}><option value="">Select</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Duration (min)</label><input className="form-input" type="number" min={5} value={form.duration_minutes} onChange={e=>setForm({...form,duration_minutes:+e.target.value})}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div className="form-group"><label className="form-label">Pass Mark (%)</label><input className="form-input" type="number" min={1} max={100} value={form.pass_mark} onChange={e=>setForm({...form,pass_mark:+e.target.value})}/></div>
            <div className="form-group"><label className="form-label">Max Attempts</label><input className="form-input" type="number" min={1} value={form.max_attempts} onChange={e=>setForm({...form,max_attempts:+e.target.value})}/></div>
            <div className="form-group"><label className="form-label">Options</label>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}><input type="checkbox" checked={form.show_results_immediately} onChange={e=>setForm({...form,show_results_immediately:e.target.checked})}/> Show results immediately</label>
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}><input type="checkbox" checked={form.randomize_questions} onChange={e=>setForm({...form,randomize_questions:e.target.checked})}/> Randomize questions</label>
              </div>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Instructions</label><textarea className="form-input" rows={2} placeholder="Instructions shown before exam…" value={form.instructions||''} onChange={e=>setForm({...form,instructions:e.target.value})}/></div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving?<Spinner/>:isEdit?'Save Changes':'Create Exam'}</button>
        </form>
      </div>
      {isEdit&&(
        <div className="card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
            <h3 style={{fontSize:15,fontWeight:700,color:'var(--primary)'}}>Questions <span style={{color:'var(--text-3)',fontWeight:400,fontSize:13}}>({questions.length})</span></h3>
            <button className="btn btn-primary btn-sm" onClick={()=>openQ()}>+ Add Question</button>
          </div>
          {questions.map((q,i)=>(
            <div key={q.id} style={{border:'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                    <span style={{width:24,height:24,borderRadius:99,background:'var(--primary-pale)',color:'var(--primary-light)',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                    <span className={`badge ${q.question_type==='mcq'?'badge-published':q.question_type==='true_false'?'badge-success':'badge-warning'}`} style={{fontSize:10}}>{q.question_type==='true_false'?'T/F':q.question_type==='short_answer'?'Short':'MCQ'}</span>
                    <span style={{fontSize:12,color:'var(--text-3)'}}>{q.marks} mark{q.marks!==1?'s':''}</span>
                  </div>
                  <p style={{fontSize:14,color:'var(--text)',lineHeight:1.55}}>{q.question_text}</p>
                  {q.options&&<div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
                    {(Array.isArray(q.options)?q.options:JSON.parse(q.options||'[]')).map((o,j)=>(
                      <span key={j} style={{fontSize:12,padding:'2px 10px',borderRadius:99,background:o===q.correct_answer?'var(--emerald)':'var(--bg-subtle)',color:o===q.correct_answer?'white':'var(--text-2)',fontWeight:o===q.correct_answer?600:400}}>{o}</span>
                    ))}
                  </div>}
                  {q.question_type!=='mcq'&&<div style={{marginTop:6,fontSize:12,color:'var(--emerald)',fontWeight:600}}>✓ {q.correct_answer}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openQ(q)}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>delQ(q.id)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
          {!questions.length&&<div style={{textAlign:'center',padding:'40px 0',color:'var(--text-3)'}}>⚠ No questions yet. Add at least one to publish.</div>}
        </div>
      )}
      {qModal&&<Modal title={qModal==='new'?'Add Question':'Edit Question'} onClose={()=>setQModal(null)} maxWidth={560}>
        <form onSubmit={saveQ} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group"><label className="form-label">Question Text</label><textarea className="form-input" required rows={3} value={qForm.question_text} onChange={e=>setQForm({...qForm,question_text:e.target.value})}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group"><label className="form-label">Type</label><select className="form-input form-select" value={qForm.question_type} onChange={e=>setQForm({...qForm,question_type:e.target.value,options:e.target.value==='mcq'?['','','','']:null,correct_answer:''})}><option value="mcq">Multiple Choice</option><option value="true_false">True / False</option><option value="short_answer">Short Answer</option></select></div>
            <div className="form-group"><label className="form-label">Marks</label><input className="form-input" type="number" min={1} max={20} value={qForm.marks} onChange={e=>setQForm({...qForm,marks:+e.target.value})}/></div>
          </div>
          {qForm.question_type==='mcq'&&<div className="form-group"><label className="form-label">Options (select correct one with radio)</label>
            {(qForm.options||['','','','']).map((o,i)=>(
              <div key={i} style={{display:'flex',gap:8,marginBottom:7,alignItems:'center'}}>
                <span style={{width:22,fontSize:12,fontWeight:600,color:'var(--text-3)',flexShrink:0}}>{String.fromCharCode(65+i)}.</span>
                <input className="form-input" placeholder={`Option ${String.fromCharCode(65+i)}`} value={o} onChange={e=>{const opts=[...(qForm.options||[])];opts[i]=e.target.value;setQForm({...qForm,options:opts});}}/>
                <input type="radio" name="correct" value={o} checked={qForm.correct_answer===o} onChange={()=>setQForm({...qForm,correct_answer:o})} title="Mark as correct"/>
              </div>
            ))}
            {!qForm.correct_answer&&<p style={{fontSize:12,color:'var(--rose)',marginTop:4}}>⚠ Select the correct option</p>}
          </div>}
          {qForm.question_type==='true_false'&&<div className="form-group"><label className="form-label">Correct Answer</label><select className="form-input form-select" value={qForm.correct_answer} onChange={e=>setQForm({...qForm,correct_answer:e.target.value})} required><option value="">Select</option><option value="True">True</option><option value="False">False</option></select></div>}
          {qForm.question_type==='short_answer'&&<div className="form-group"><label className="form-label">Correct Answer</label><input className="form-input" required placeholder="Exact answer (case-insensitive)" value={qForm.correct_answer} onChange={e=>setQForm({...qForm,correct_answer:e.target.value})}/></div>}
          <div className="form-group"><label className="form-label">Explanation <span style={{color:'var(--text-3)',fontWeight:400}}>(optional, shown after submission)</span></label><textarea className="form-input" rows={2} value={qForm.explanation} onChange={e=>setQForm({...qForm,explanation:e.target.value})}/></div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <button type="button" className="btn btn-ghost" onClick={()=>setQModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={qSaving||(qForm.question_type==='mcq'&&!qForm.correct_answer)}>{qSaving?<Spinner/>:qModal==='new'?'Add Question':'Save'}</button>
          </div>
        </form>
      </Modal>}
    </div>
  );
}
function ExamResults() {
  const { id } = useParams();
  const [results,setResults]=useState([]); const [exam,setExam]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{ Promise.all([api.get(`/exams?id=${id}`),api.get(`/exams?id=${id}&action=results`)]).then(([e,r])=>{setExam(e);setResults(r);}).finally(()=>setLoading(false)); },[id]);
  const gc=g=>g==='A'||g==='B'?'#10b981':g==='F'?'#f43f5e':'#f59e0b';
  if(loading) return <div style={{textAlign:'center',paddingTop:80}}><Spinner lg/></div>;
  const avg=results.length?(results.reduce((a,r)=>a+parseFloat(r.percentage||0),0)/results.length).toFixed(1):0;
  const pass=results.filter(r=>parseFloat(r.percentage)>=(exam?.pass_mark||50)).length;
  return (
    <div className="page">
      <Link to="/teacher/exams" style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:12}}>← Back</Link>
      <h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)',marginBottom:4}}>{exam?.title} — Results</h1>
      <p style={{color:'var(--text-2)',fontSize:13,marginBottom:22}}>{results.length} submissions · Avg: {avg}% · Pass rate: {results.length?Math.round(pass/results.length*100):0}%</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:22}}>
        {[['Submissions',results.length,'#6366f1'],['Average',`${avg}%`,'#10b981'],['Highest',results[0]?`${parseFloat(results[0].percentage).toFixed(0)}%`:'—','#f59e0b'],['Pass Rate',`${results.length?Math.round(pass/results.length*100):0}%`,'#0ea5e9']].map(([l,v,c])=>(
          <div key={l} className="stat-card"><p style={{fontSize:11,color:'var(--text-2)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:5}}>{l}</p><p style={{fontSize:24,fontWeight:800,color:c}}>{v}</p></div>
        ))}
      </div>
      <div className="card" style={{padding:0}}><div className="table-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Score</th><th>%</th><th>Grade</th><th>Time</th><th>Submitted</th></tr></thead><tbody>
        {results.map((r,i)=>(<tr key={r.id}><td style={{color:'var(--text-3)',fontSize:12}}>{i+1}</td><td style={{fontWeight:600,fontSize:13}}>{r.student_name}<div style={{fontSize:11,color:'var(--text-3)'}}>{r.student_no}</div></td><td style={{fontWeight:700}}>{r.score}/{r.total_marks}</td><td style={{fontWeight:600,color:gc(r.grade)}}>{parseFloat(r.percentage).toFixed(1)}%</td><td><strong style={{color:gc(r.grade),fontSize:16}}>{r.grade}</strong></td><td style={{color:'var(--text-3)',fontSize:12}}>{r.time_taken_minutes}m</td><td style={{color:'var(--text-3)',fontSize:12}}>{new Date(r.submitted_at).toLocaleString()}</td></tr>))}
        {!results.length&&<tr><td colSpan={7} style={{textAlign:'center',color:'var(--text-3)',padding:40}}>No submissions yet</td></tr>}
      </tbody></table></div></div>
    </div>
  );
}

// ─── STUDENT ─────────────────────────────────────────────────────────────────
const STUDENT_NAV=[{to:'/student',icon:'🏠',label:'Dashboard',end:true},{to:'/student/exams',icon:'📄',label:'My Exams'},{to:'/student/history',icon:'📋',label:'History'},{to:'/student/notifications',icon:'🔔',label:'Notifications'}];
function StudentDashboard() {
  return <Layout nav={STUDENT_NAV}><Routes>
    <Route index element={<StudentHome/>}/>
    <Route path="exams" element={<StudentExams/>}/>
    <Route path="exams/:examId/take" element={<TakeExam/>}/>
    <Route path="results/:id" element={<ExamResult/>}/>
    <Route path="history" element={<StudentHistory/>}/>
    <Route path="notifications" element={<Notifications/>}/>
  </Routes></Layout>;
}
function StudentHome() {
  const { user } = useAuth();
  const [exams,setExams]=useState([]); const [history,setHistory]=useState([]); const [ann,setAnn]=useState([]);
  useEffect(()=>{ api.get('/exams').then(r=>setExams(r)); Promise.all([api.get('/attempts?action=history'),api.get('/announcements')]).then(([h,a])=>{setHistory(h);setAnn(a);}); },[]);
  const submitted=history.filter(h=>h.status==='submitted');
  const avg=submitted.length?(submitted.reduce((a,h)=>a+parseFloat(h.percentage||0),0)/submitted.length).toFixed(1):0;
  const available=exams.filter(e=>e.status==='published'||e.status==='active');
  return (
    <div className="page">
      <h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)',marginBottom:4}}>Hello, {user?.full_name?.split(' ')[0]} 👋</h1>
      <p style={{color:'var(--text-2)',fontSize:14,marginBottom:24}}>{user?.class} · Student Portal</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        {[['Available',available.length,'#6366f1'],['Completed',submitted.length,'#10b981'],['Avg Score',`${avg}%`,'#f59e0b'],['In Progress',history.filter(h=>h.status==='in_progress').length,'#0ea5e9']].map(([l,v,c])=>(
          <div key={l} className="stat-card"><p style={{fontSize:11,color:'var(--text-2)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:5}}>{l}</p><p style={{fontSize:26,fontWeight:800,color:c}}>{v}</p></div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20}}>
        <div className="card"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Available Exams</h3>
          {available.map(e=>(
            <div key={e.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
              <div><div style={{fontSize:14,fontWeight:600,color:'var(--primary)'}}>{e.title}</div><div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{e.subject_name} · ⏱ {e.duration_minutes}min</div></div>
              {e.attempt_id?<Link to={`/student/results/${e.attempt_id}`} className="btn btn-ghost btn-sm">View Result</Link>:<Link to={`/student/exams/${e.id}/take`} className="btn btn-primary btn-sm">Start →</Link>}
            </div>
          ))}
          {!available.length&&<p style={{color:'var(--text-3)',textAlign:'center',padding:24,fontSize:13}}>No exams available right now</p>}
        </div>
        <div className="card"><h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Announcements</h3>
          {ann.slice(0,5).map(a=>(
            <div key={a.id} style={{padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
              {a.is_pinned&&<div style={{fontSize:10,color:'#b45309',fontWeight:700,marginBottom:3}}>📌 PINNED</div>}
              <div style={{fontSize:13,fontWeight:600,color:'var(--primary)',marginBottom:2}}>{a.title}</div>
              <div style={{fontSize:12,color:'var(--text-3)'}}>{new Date(a.created_at).toLocaleDateString()}</div>
            </div>
          ))}
          {!ann.length&&<p style={{color:'var(--text-3)',textAlign:'center',padding:20,fontSize:13}}>No announcements</p>}
        </div>
      </div>
    </div>
  );
}
function StudentExams() {
  const [exams,setExams]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/exams').then(r=>setExams(r)).finally(()=>setLoading(false)); },[]);
  if(loading) return <div style={{textAlign:'center',paddingTop:80}}><Spinner lg/></div>;
  return (
    <div className="page">
      <h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)',marginBottom:6}}>My Exams</h1>
      <p style={{color:'var(--text-2)',fontSize:14,marginBottom:22}}>All exams available for your class</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {exams.map(e=>(
          <div key={e.id} className="card" style={{position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}><StatusBadge s={e.status}/>{e.my_score!=null&&<span style={{fontSize:12,fontWeight:700,color:'#10b981'}}>✓ {parseFloat(e.my_score).toFixed(0)}%</span>}</div>
            <h3 style={{fontSize:16,fontWeight:700,color:'var(--primary)',marginBottom:6,lineHeight:1.3}}>{e.title}</h3>
            <p style={{fontSize:12,color:'var(--text-3)',marginBottom:14}}>{e.subject_name||'General'} · {e.teacher_name}</p>
            <div style={{display:'flex',gap:14,fontSize:12,color:'var(--text-3)',marginBottom:16}}><span>📋 {e.question_count||0} questions</span><span>⏱ {e.duration_minutes}min</span><span>🎯 Pass: {e.pass_mark}%</span></div>
            {e.attempt_id?<Link to={`/student/results/${e.attempt_id}`} className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}}>✓ View Result</Link>
            :(e.status==='published'||e.status==='active')?<Link to={`/student/exams/${e.id}/take`} className="btn btn-primary btn-sm" style={{width:'100%',justifyContent:'center'}}>Start Exam →</Link>
            :<div className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center',opacity:.5,cursor:'default'}}>Not available</div>}
          </div>))}
        {!exams.length&&<div style={{gridColumn:'1/-1',textAlign:'center',paddingTop:60,color:'var(--text-3)'}}>No exams available. Check back later.</div>}
      </div>
    </div>
  );
}
function TakeExam() {
  const { examId } = useParams(); const nav = useNavigate();
  const [exam,setExam]=useState(null); const [attempt,setAttempt]=useState(null); const [answers,setAnswers]=useState({}); const [current,setCurrent]=useState(0); const [timeLeft,setTimeLeft]=useState(null); const [phase,setPhase]=useState('loading'); const [result,setResult]=useState(null);
  const timerRef=useRef(null);
  useEffect(()=>{ api.get(`/exams?id=${examId}`).then(r=>{setExam(r);setPhase('intro');}).catch(()=>{toast.error('Exam not found');nav('/student');}); return()=>clearInterval(timerRef.current); },[examId]);
  const startExam=async()=>{ try{
    const d=await api.post('/attempts?action=start',{exam_id:examId});
    setAttempt(d.attempt); setAnswers(d.attempt.answers||{}); setTimeLeft((exam.duration_minutes||60)*60); setPhase('exam');
    timerRef.current=setInterval(()=>setTimeLeft(t=>{if(t<=1){clearInterval(timerRef.current);handleSubmit(true);return 0;}return t-1;}),1000);
  }catch(e){toast.error(e.message||'Could not start exam');} };
  const selectAnswer=async(qid,ans)=>{ const updated={...answers,[qid]:ans}; setAnswers(updated); if(attempt){try{await api.put(`/attempts?id=${attempt.id}&action=answer`,{question_id:qid,answer:ans});}catch{}} };
  const handleSubmit=useCallback(async(auto=false)=>{ if(!attempt)return; if(!auto&&!window.confirm('Submit exam? You cannot change answers after submission.'))return; clearInterval(timerRef.current); setPhase('submitting');
    try{const d=await api.post(`/attempts?id=${attempt.id}&action=submit`,{answers});setResult(d);setPhase('done');}catch(e){toast.error('Submission failed. Retrying…');setPhase('exam');}
  },[attempt,answers]);
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const pct=exam?Math.round(Object.keys(answers).length/(exam.questions?.length||1)*100):0;
  if(phase==='loading') return <div style={{textAlign:'center',paddingTop:100}}><Spinner lg/></div>;
  if(phase==='intro') return (
    <div className="page" style={{maxWidth:640,margin:'0 auto'}}>
      <div className="card" style={{textAlign:'center'}}>
        <div style={{width:68,height:68,borderRadius:20,background:'var(--primary-pale)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:32}}>📄</div>
        <h1 style={{fontSize:24,fontWeight:800,color:'var(--primary)',marginBottom:8}}>{exam.title}</h1>
        <p style={{color:'var(--text-2)',marginBottom:24}}>{exam.subject_name} · {exam.class_level}</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
          {[['Questions',exam.questions?.length||0,'📋'],['Duration',`${exam.duration_minutes} min`,'⏱'],['Pass Mark',`${exam.pass_mark}%`,'🎯']].map(([l,v,i])=>(
            <div key={l} style={{background:'var(--bg-subtle)',borderRadius:12,padding:'14px 10px',textAlign:'center'}}><div style={{fontSize:22,marginBottom:6}}>{i}</div><div style={{fontSize:20,fontWeight:800,color:'var(--primary)'}}>{v}</div><div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{l}</div></div>
          ))}
        </div>
        {exam.instructions&&<div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:12,padding:16,marginBottom:24,textAlign:'left'}}><div style={{fontSize:13,fontWeight:700,color:'#b45309',marginBottom:6}}>📌 Instructions</div><p style={{fontSize:13,color:'#78350f',lineHeight:1.65,whiteSpace:'pre-wrap'}}>{exam.instructions}</p></div>}
        <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:14,marginBottom:24,fontSize:13,color:'#166534',textAlign:'left'}}>
          <div style={{fontWeight:700,marginBottom:4}}>✅ Before you start:</div>
          <ul style={{paddingLeft:18,lineHeight:1.9}}><li>Ensure stable internet connection</li><li>Find a quiet place — timer starts immediately</li><li>Answers are auto-saved as you go</li><li>You can revisit questions before submitting</li></ul>
        </div>
        <button className="btn btn-primary btn-lg" onClick={startExam} style={{width:'100%',justifyContent:'center',fontSize:16}}>Start Exam — Timer Begins Now →</button>
      </div>
    </div>
  );
  if(phase==='submitting') return <div style={{textAlign:'center',paddingTop:120}}><Spinner lg/><h2 style={{fontSize:20,color:'var(--primary)',marginTop:20}}>Submitting your exam…</h2><p style={{color:'var(--text-2)',marginTop:8}}>Please wait, do not close this page</p></div>;
  if(phase==='done'&&result) {
    const att=result.attempt; const pct2=parseFloat(att.percentage||0); const pass=pct2>=(exam?.pass_mark||50);
    const gc=g=>g==='A'||g==='B'?'#10b981':g==='F'?'#f43f5e':'#f59e0b';
    return (
      <div className="page" style={{maxWidth:600,margin:'0 auto'}}>
        <div className="card" style={{textAlign:'center'}}>
          <div style={{width:80,height:80,borderRadius:99,background:pass?'#ecfdf5':'#fff1f2',border:`3px solid ${pass?'#10b981':'#f43f5e'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:40}}>{pass?'🎉':'😔'}</div>
          <h1 style={{fontSize:28,fontWeight:800,color:'var(--primary)',marginBottom:8}}>{pass?'Congratulations!':'Keep Trying!'}</h1>
          <p style={{color:'var(--text-2)',marginBottom:28}}>{pass?'You passed this exam!':'You did not meet the pass mark this time.'}</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:28}}>
            {[['Score',`${att.score}/${att.total_marks}`,'#6366f1'],['Percentage',`${pct2.toFixed(1)}%`,gc(att.grade)],['Grade',att.grade,gc(att.grade)]].map(([l,v,c])=>(
              <div key={l} style={{background:'var(--bg-subtle)',borderRadius:14,padding:'18px 10px'}}><div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>{l}</div><div style={{fontSize:28,fontWeight:800,color:c}}>{v}</div></div>
            ))}
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <Link to={`/student/results/${att.id}`} className="btn btn-primary">View Detailed Results</Link>
            <Link to="/student/exams" className="btn btn-ghost">Back to Exams</Link>
          </div>
        </div>
      </div>
    );
  }
  const questions=exam?.questions||[]; const q=questions[current]; const totalQ=questions.length; const answered=Object.keys(answers).length; const isLow=timeLeft!==null&&timeLeft<300;
  return (
    <div style={{maxWidth:900,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18,background:'white',borderRadius:14,padding:'12px 18px',border:'1px solid var(--border)',boxShadow:'var(--shadow)'}}>
        <div><div style={{fontSize:14,fontWeight:700,color:'var(--primary)'}}>{exam.title}</div><div style={{fontSize:12,color:'var(--text-3)',marginTop:1}}>Question {current+1} of {totalQ} · {answered} answered</div></div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:80,height:6,background:'var(--border)',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:'var(--primary-light)',borderRadius:99,transition:'width .3s'}}/></div><span style={{fontSize:12,color:'var(--text-3)'}}>{pct}%</span></div>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:99,background:isLow?'#fff1f2':'var(--bg-subtle)',border:`1px solid ${isLow?'#fecdd3':'var(--border)'}`,color:isLow?'#f43f5e':'var(--text-2)'}}>⏱ <span style={{fontWeight:700,fontSize:14}}>{timeLeft!==null?fmt(timeLeft):'--:--'}</span></div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 200px',gap:16}}>
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
            <span style={{width:30,height:30,borderRadius:99,background:'var(--primary)',color:'white',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{current+1}</span>
            <div style={{display:'flex',gap:8}}>
              <span className={`badge ${q?.question_type==='mcq'?'badge-published':q?.question_type==='true_false'?'badge-success':'badge-warning'}`} style={{fontSize:10}}>{q?.question_type==='true_false'?'T/F':q?.question_type==='short_answer'?'Short':'MCQ'}</span>
              <span style={{fontSize:12,color:'var(--text-3)'}}>{q?.marks} mark{q?.marks!==1?'s':''}</span>
            </div>
          </div>
          <p style={{fontSize:16,color:'var(--text)',lineHeight:1.7,marginBottom:22}}>{q?.question_text}</p>
          {q?.question_type==='mcq'&&<div style={{display:'flex',flexDirection:'column',gap:10}}>
            {(Array.isArray(q.options)?q.options:JSON.parse(q.options||'[]')).map((opt,i)=>{
              const sel=answers[q.id]===opt;
              return <button key={i} onClick={()=>selectAnswer(q.id,opt)} style={{padding:'13px 18px',borderRadius:12,border:`2px solid ${sel?'var(--primary-light)':'var(--border)'}`,background:sel?'var(--primary-pale)':'white',color:sel?'var(--primary-light)':'var(--text)',fontWeight:sel?600:400,fontSize:14,textAlign:'left',transition:'all .15s',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
                <span style={{width:28,height:28,borderRadius:99,background:sel?'var(--primary-light)':'var(--bg-subtle)',color:sel?'white':'var(--text-3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{sel?'✓':String.fromCharCode(65+i)}</span>{opt}
              </button>;
            })}
          </div>}
          {q?.question_type==='true_false'&&<div style={{display:'flex',gap:12}}>
            {['True','False'].map(opt=>{const sel=answers[q.id]===opt;return <button key={opt} onClick={()=>selectAnswer(q.id,opt)} style={{flex:1,padding:'16px',borderRadius:14,border:`2px solid ${sel?'var(--primary-light)':'var(--border)'}`,background:sel?'var(--primary-pale)':'white',color:sel?'var(--primary-light)':'var(--text)',fontWeight:700,fontSize:16,transition:'all .15s',cursor:'pointer'}}>{opt==='True'?'✅ True':'❌ False'}</button>;})}
          </div>}
          {q?.question_type==='short_answer'&&<input className="form-input" placeholder="Type your answer…" style={{fontSize:15}} value={answers[q?.id]||''} onChange={e=>selectAnswer(q.id,e.target.value)}/>}
          <div style={{display:'flex',justifyContent:'space-between',marginTop:24}}>
            <button className="btn btn-ghost" onClick={()=>setCurrent(p=>Math.max(0,p-1))} disabled={current===0}>← Previous</button>
            {current<totalQ-1?<button className="btn btn-primary" onClick={()=>setCurrent(p=>Math.min(totalQ-1,p+1))}>Next →</button>:<button className="btn btn-success" onClick={()=>handleSubmit(false)}>✓ Submit Exam</button>}
          </div>
        </div>
        <div><div className="card" style={{padding:16}}>
          <div style={{fontSize:12,fontWeight:700,color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:12}}>Questions</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
            {questions.map((_,i)=>{const a2=answers[questions[i]?.id]!==undefined;const act=i===current;return <button key={i} onClick={()=>setCurrent(i)} style={{width:'100%',aspectRatio:'1',borderRadius:8,border:`2px solid ${act?'var(--primary-light)':a2?'var(--emerald)':'var(--border)'}`,background:act?'var(--primary-light)':a2?'#ecfdf5':'white',color:act?'white':a2?'#059669':'var(--text-3)',fontSize:12,fontWeight:act||a2?700:400,transition:'all .12s',cursor:'pointer'}}>{i+1}</button>;})}
          </div>
          <div style={{marginTop:14,fontSize:11,color:'var(--text-3)',display:'flex',flexDirection:'column',gap:5}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:10,height:10,borderRadius:2,background:'var(--emerald)',display:'block'}}/> Answered ({answered})</div>
            <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:10,height:10,borderRadius:2,background:'white',border:'1.5px solid var(--border)',display:'block'}}/> Unanswered ({totalQ-answered})</div>
          </div>
          <button className="btn btn-danger" onClick={()=>handleSubmit(false)} style={{width:'100%',justifyContent:'center',marginTop:16,fontSize:13}}>Submit Exam</button>
        </div></div>
      </div>
    </div>
  );
}
function ExamResult() {
  const { id } = useParams(); const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get(`/attempts?id=${id}&action=result`).then(r=>setData(r)).finally(()=>setLoading(false)); },[id]);
  if(loading) return <div style={{textAlign:'center',paddingTop:80}}><Spinner lg/></div>;
  if(!data) return <div style={{textAlign:'center',paddingTop:80,color:'var(--text-3)'}}>Result not found</div>;
  const pct=parseFloat(data.percentage||0); const pass=pct>=50; const gc=g=>g==='A'||g==='B'?'#10b981':g==='F'?'#f43f5e':'#f59e0b';
  const answers=typeof data.answers==='string'?JSON.parse(data.answers||'{}'):(data.answers||{});
  return (
    <div className="page">
      <Link to="/student/exams" style={{display:'inline-flex',alignItems:'center',gap:6,color:'var(--text-2)',fontSize:13,marginBottom:18}}>← Back to Exams</Link>
      <h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)',marginBottom:4}}>{data.exam_title}</h1>
      <p style={{color:'var(--text-2)',fontSize:14,marginBottom:24}}>{data.subject_name} · Submitted {new Date(data.submitted_at).toLocaleString()}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        {[['Score',`${data.score}/${data.total_marks}`,'#6366f1'],['Percentage',`${pct.toFixed(1)}%`,gc(data.grade)],['Grade',data.grade,gc(data.grade)],['Time',`${data.time_taken_minutes}min`,'#0ea5e9']].map(([l,v,c])=>(
          <div key={l} className="stat-card"><p style={{fontSize:11,color:'var(--text-2)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:5}}>{l}</p><p style={{fontSize:26,fontWeight:800,color:c}}>{v}</p></div>
        ))}
      </div>
      <div style={{padding:'14px 20px',borderRadius:14,background:pass?'#f0fdf4':'#fff1f2',border:`1px solid ${pass?'#bbf7d0':'#fecdd3'}`,marginBottom:24,display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:28}}>{pass?'🎉':'📚'}</span>
        <div><div style={{fontWeight:700,color:pass?'#166534':'#9f1239',fontSize:15}}>{pass?'You Passed!':'Below Pass Mark'}</div><div style={{fontSize:13,color:pass?'#166534':'#9f1239',marginTop:2}}>{pass?'Great work! Keep it up.':'Review the material and try again!'}</div></div>
      </div>
      {data.questions?.length>0&&<div className="card">
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:18,color:'var(--primary)'}}>Answer Review</h3>
        {data.questions.map((q,i)=>{
          const ans=answers[q.id]; const correct=ans?.is_correct;
          return <div key={q.id} style={{padding:'16px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{width:26,height:26,borderRadius:99,background:correct?'#ecfdf5':'#fff1f2',border:`1.5px solid ${correct?'#10b981':'#f43f5e'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{correct?'✓':'✗'}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:14,color:'var(--text)',lineHeight:1.6,marginBottom:10}}><strong>Q{i+1}.</strong> {q.question_text}</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,fontSize:13}}>
                  <div style={{padding:'8px 12px',borderRadius:9,background:'#fff1f2',border:'1px solid #fecdd3'}}><div style={{fontSize:10,fontWeight:700,color:'#9f1239',marginBottom:3}}>YOUR ANSWER</div><div style={{color:'#e11d48'}}>{ans?.student_answer||'Not answered'}</div></div>
                  <div style={{padding:'8px 12px',borderRadius:9,background:'#f0fdf4',border:'1px solid #bbf7d0'}}><div style={{fontSize:10,fontWeight:700,color:'#166534',marginBottom:3}}>CORRECT ANSWER</div><div style={{color:'#059669',fontWeight:600}}>{ans?.correct_answer||q.correct_answer}</div></div>
                </div>
                {q.explanation&&<div style={{marginTop:8,padding:'8px 12px',borderRadius:9,background:'#eff6ff',border:'1px solid #bfdbfe',fontSize:12,color:'#1d4ed8'}}><strong>💡 Explanation:</strong> {q.explanation}</div>}
              </div>
            </div>
          </div>;
        })}
      </div>}
    </div>
  );
}
function StudentHistory() {
  const [history,setHistory]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ api.get('/attempts?action=history').then(r=>setHistory(r)).finally(()=>setLoading(false)); },[]);
  const gc=g=>g==='A'||g==='B'?'#10b981':g==='F'?'#f43f5e':'#f59e0b';
  return (
    <div className="page">
      <h1 style={{fontSize:22,fontWeight:800,color:'var(--primary)',marginBottom:6}}>Exam History</h1>
      <p style={{color:'var(--text-2)',fontSize:14,marginBottom:22}}>All your past exam attempts</p>
      <div className="card" style={{padding:0}}><div className="table-wrap"><table><thead><tr><th>Exam</th><th>Subject</th><th>Score</th><th>%</th><th>Grade</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>
        {loading?<tr><td colSpan={8} style={{textAlign:'center',padding:40}}><Spinner/></td></tr>
        :history.map(h=>(
          <tr key={h.id}>
            <td style={{fontWeight:600,fontSize:13}}><div style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.exam_title}</div></td>
            <td style={{color:'var(--text-3)',fontSize:12}}>{h.subject_name||'—'}</td>
            <td style={{fontWeight:600}}>{h.status==='submitted'?`${h.score}/${h.total_marks}`:'—'}</td>
            <td style={{fontWeight:600,color:h.grade?gc(h.grade):'var(--text-3)'}}>{h.percentage?`${parseFloat(h.percentage).toFixed(1)}%`:'—'}</td>
            <td>{h.grade?<strong style={{color:gc(h.grade),fontSize:15}}>{h.grade}</strong>:'—'}</td>
            <td><span className={`badge badge-${h.status==='submitted'?'success':h.status==='in_progress'?'published':'archived'}`} style={{textTransform:'capitalize'}}>{h.status}</span></td>
            <td style={{color:'var(--text-3)',fontSize:12}}>{new Date(h.created_at).toLocaleDateString()}</td>
            <td>{h.status==='submitted'&&<Link to={`/student/results/${h.id}`} style={{fontSize:12,color:'var(--primary-light)',fontWeight:600}}>View →</Link>}</td>
          </tr>))}
        {!loading&&!history.length&&<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-3)',padding:40}}>No exam history yet</td></tr>}
      </tbody></table></div></div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Landing/>;
  if (user.role==='admin')   return <Navigate to="/admin"   replace/>;
  if (user.role==='teacher') return <Navigate to="/teacher" replace/>;
  return <Navigate to="/student" replace/>;
}
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster/>
        <Routes>
          <Route path="/"         element={<RootRedirect/>}/>
          <Route path="/login"    element={<Login/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/admin/*"   element={<ProtectedRoute role="admin"><AdminDashboard/></ProtectedRoute>}/>
          <Route path="/teacher/*" element={<ProtectedRoute role="teacher"><TeacherDashboard/></ProtectedRoute>}/>
          <Route path="/student/*" element={<ProtectedRoute role="student"><StudentDashboard/></ProtectedRoute>}/>
          <Route path="*"          element={<Navigate to="/" replace/>}/>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
