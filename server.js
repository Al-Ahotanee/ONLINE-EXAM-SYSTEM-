const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ─── DB ───────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (sql, p = []) => pool.query(sql, p);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ok  = (res, data, s = 200) => res.status(s).json(data);
const err = (res, msg, s = 400) => res.status(s).json({ error: msg });
const JWT = process.env.JWT_SECRET || 'gss-gadau-secret-2024';
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981','#3b82f6'];
const randColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const calcGrade = p => p>=70?'A':p>=60?'B':p>=50?'C':p>=45?'D':p>=40?'E':'F';

const getUser = async (req) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  try {
    const d = jwt.verify(h.slice(7), JWT);
    const r = await q('SELECT id,full_name,email,role,class,student_id,is_active FROM users WHERE id=$1', [d.id]);
    return r.rows[0]?.is_active ? r.rows[0] : null;
  } catch { return null; }
};
const auth   = async (req, res) => { const u = await getUser(req); if (!u) { err(res,'Unauthorized',401); return null; } return u; };
const role   = async (req, res, ...roles) => { const u = await auth(req,res); if (!u) return null; if (!roles.includes(u.role)) { err(res,'Forbidden',403); return null; } return u; };

// ─── DB Init ──────────────────────────────────────────────────────────────────
const initDB = async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`CREATE TABLE IF NOT EXISTS users(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),full_name VARCHAR(255) NOT NULL,email VARCHAR(255) UNIQUE NOT NULL,password_hash VARCHAR(255) NOT NULL,role VARCHAR(20) NOT NULL CHECK(role IN('admin','teacher','student')),student_id VARCHAR(50) UNIQUE,class VARCHAR(50),subject_specialization VARCHAR(100),is_active BOOLEAN DEFAULT true,avatar_color VARCHAR(20) DEFAULT '#6366f1',created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW())`);
    await c.query(`CREATE TABLE IF NOT EXISTS subjects(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name VARCHAR(255) NOT NULL,code VARCHAR(20) UNIQUE NOT NULL,class_level VARCHAR(50) NOT NULL,teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,description TEXT,created_at TIMESTAMPTZ DEFAULT NOW())`);
    await c.query(`CREATE TABLE IF NOT EXISTS exams(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(255) NOT NULL,subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,class_level VARCHAR(50) NOT NULL,instructions TEXT,duration_minutes INTEGER NOT NULL DEFAULT 60,total_marks INTEGER NOT NULL DEFAULT 100,pass_mark INTEGER NOT NULL DEFAULT 50,start_time TIMESTAMPTZ,end_time TIMESTAMPTZ,status VARCHAR(20) DEFAULT 'draft' CHECK(status IN('draft','published','active','completed','archived')),randomize_questions BOOLEAN DEFAULT false,show_results_immediately BOOLEAN DEFAULT true,max_attempts INTEGER DEFAULT 1,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW())`);
    await c.query(`CREATE TABLE IF NOT EXISTS questions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,question_text TEXT NOT NULL,question_type VARCHAR(20) DEFAULT 'mcq' CHECK(question_type IN('mcq','true_false','short_answer')),options JSONB,correct_answer TEXT NOT NULL,marks INTEGER NOT NULL DEFAULT 1,explanation TEXT,order_index INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW())`);
    await c.query(`CREATE TABLE IF NOT EXISTS exam_attempts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,student_id UUID REFERENCES users(id) ON DELETE CASCADE,started_at TIMESTAMPTZ DEFAULT NOW(),submitted_at TIMESTAMPTZ,time_taken_minutes INTEGER,score INTEGER,total_marks INTEGER,percentage DECIMAL(5,2),grade VARCHAR(5),status VARCHAR(20) DEFAULT 'in_progress' CHECK(status IN('in_progress','submitted','timed_out','flagged')),answers JSONB DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT NOW())`);
    await c.query(`CREATE TABLE IF NOT EXISTS notifications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users(id) ON DELETE CASCADE,title VARCHAR(255) NOT NULL,message TEXT NOT NULL,type VARCHAR(20) DEFAULT 'info' CHECK(type IN('info','success','warning','exam')),is_read BOOLEAN DEFAULT false,created_at TIMESTAMPTZ DEFAULT NOW())`);
    await c.query(`CREATE TABLE IF NOT EXISTS announcements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),title VARCHAR(255) NOT NULL,content TEXT NOT NULL,author_id UUID REFERENCES users(id) ON DELETE SET NULL,target_role VARCHAR(20),target_class VARCHAR(50),is_pinned BOOLEAN DEFAULT false,created_at TIMESTAMPTZ DEFAULT NOW())`);
    await c.query('COMMIT');
    const exists = await q("SELECT id FROM users WHERE email='admin@gssgadau.edu.ng'");
    if (!exists.rows.length) {
      const hash = await bcrypt.hash('Admin@2024', 10);
      await q(`INSERT INTO users(full_name,email,password_hash,role)VALUES('System Administrator','admin@gssgadau.edu.ng',$1,'admin')`,[hash]);
    }
    console.log('DB ready');
  } catch (e) { await c.query('ROLLBACK'); console.error('DB init error:', e.message); } finally { c.release(); }
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return err(res, 'Email and password required');
  const r = await q('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);
  if (!r.rows[0]) return err(res, 'Invalid credentials', 401);
  const valid = await bcrypt.compare(password, r.rows[0].password_hash);
  if (!valid) return err(res, 'Invalid credentials', 401);
  const token = jwt.sign({ id: r.rows[0].id, role: r.rows[0].role }, JWT, { expiresIn: '7d' });
  const { password_hash, ...safe } = r.rows[0];
  ok(res, { token, user: safe });
});

app.post('/api/register', async (req, res) => {
  const { full_name, email, password, role: rl, class: cls, student_id, subject_specialization } = req.body;
  if (!full_name || !email || !password || !rl) return err(res, 'All required fields missing');
  const ex = await q('SELECT id FROM users WHERE email=$1', [email]);
  if (ex.rows.length) return err(res, 'Email already registered', 409);
  const hash = await bcrypt.hash(password, 12);
  const r = await q(`INSERT INTO users(full_name,email,password_hash,role,class,student_id,subject_specialization,avatar_color)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING id,full_name,email,role,class,student_id,avatar_color`,[full_name,email,hash,rl,cls||null,student_id||null,subject_specialization||null,randColor()]);
  const user = r.rows[0];
  const token = jwt.sign({ id: user.id, role: user.role }, JWT, { expiresIn: '7d' });
  await q("INSERT INTO notifications(user_id,title,message,type)VALUES($1,$2,$3,'success')",[user.id,'Welcome to GSS Gadau!',`Hello ${user.full_name}, your account is ready.`]);
  ok(res, { token, user }, 201);
});

app.get('/api/me', async (req, res) => {
  const u = await auth(req, res); if (!u) return;
  const r = await q('SELECT id,full_name,email,role,class,student_id,subject_specialization,avatar_color,created_at FROM users WHERE id=$1',[u.id]);
  ok(res, r.rows[0]);
});

app.put('/api/me', async (req, res) => {
  const u = await auth(req, res); if (!u) return;
  const { full_name, class: cls, current_password, new_password } = req.body;
  if (current_password && new_password) {
    const r = await q('SELECT password_hash FROM users WHERE id=$1',[u.id]);
    const valid = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!valid) return err(res,'Current password incorrect');
    const hash = await bcrypt.hash(new_password, 12);
    await q('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',[hash,u.id]);
    return ok(res,{message:'Password changed'});
  }
  const r = await q('UPDATE users SET full_name=COALESCE($1,full_name),class=COALESCE($2,class),updated_at=NOW() WHERE id=$3 RETURNING id,full_name,email,role,class,student_id,avatar_color',[full_name,cls,u.id]);
  ok(res,r.rows[0]);
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const r = await q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[u.id]);
  const unrd = await q('SELECT COUNT(*) c FROM notifications WHERE user_id=$1 AND is_read=false',[u.id]);
  ok(res,{notifications:r.rows, unread_count:+unrd.rows[0].c});
});
app.put('/api/notifications', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  await q('UPDATE notifications SET is_read=true WHERE user_id=$1',[u.id]);
  ok(res,{message:'Marked read'});
});

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
app.get('/api/announcements', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const r = await q(`SELECT a.*,u.full_name author_name FROM announcements a LEFT JOIN users u ON a.author_id=u.id WHERE a.target_role IS NULL OR a.target_role=$1 ORDER BY a.is_pinned DESC,a.created_at DESC LIMIT 20`,[u.role]);
  ok(res,r.rows);
});
app.post('/api/admin-announce', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const { title, content, target_role, target_class, is_pinned } = req.body;
  const r = await q('INSERT INTO announcements(title,content,author_id,target_role,target_class,is_pinned)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[title,content,u.id,target_role||null,target_class||null,is_pinned||false]);
  ok(res,r.rows[0],201);
});
app.get('/api/admin-announce', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const r = await q(`SELECT a.*,u.full_name author_name FROM announcements a LEFT JOIN users u ON a.author_id=u.id ORDER BY is_pinned DESC,created_at DESC`);
  ok(res,r.rows);
});

// ─── SUBJECTS ────────────────────────────────────────────────────────────────
app.get('/api/subjects', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  let sql='SELECT s.*,u.full_name teacher_name FROM subjects s LEFT JOIN users u ON s.teacher_id=u.id',p=[];
  if (u.role==='student'){p.push(u.class);sql+=' WHERE s.class_level=$1';}
  sql+=' ORDER BY s.name';
  ok(res,(await q(sql,p)).rows);
});
app.get('/api/teachers', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  ok(res,(await q("SELECT id,full_name,email,subject_specialization,avatar_color FROM users WHERE role='teacher' AND is_active=true ORDER BY full_name")).rows);
});

// ─── ADMIN: USERS ─────────────────────────────────────────────────────────────
app.get('/api/admin-users', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const { role: rl, search, page=1, limit=20 } = req.query;
  let sql='SELECT id,full_name,email,role,class,student_id,subject_specialization,avatar_color,is_active,created_at FROM users WHERE 1=1',p=[];
  if (rl)     { p.push(rl);          sql+=` AND role=$${p.length}`; }
  if (search) { p.push(`%${search}%`); sql+=` AND(full_name ILIKE $${p.length} OR email ILIKE $${p.length})`; }
  sql+=` ORDER BY created_at DESC LIMIT ${+limit} OFFSET ${(+page-1)*+limit}`;
  const r   = await q(sql,p);
  const cnt = await q('SELECT COUNT(*) c FROM users');
  ok(res,{users:r.rows,total:+cnt.rows[0].c});
});
app.post('/api/admin-users', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const { full_name, email, password, role: rl, class: cls, student_id, subject_specialization } = req.body;
  const ex = await q('SELECT id FROM users WHERE email=$1',[email]);
  if (ex.rows.length) return err(res,'Email already exists',409);
  const hash = await bcrypt.hash(password||'Password@123',12);
  const r = await q(`INSERT INTO users(full_name,email,password_hash,role,class,student_id,subject_specialization,avatar_color)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING id,full_name,email,role,class,student_id,avatar_color,is_active,created_at`,[full_name,email,hash,rl,cls||null,student_id||null,subject_specialization||null,randColor()]);
  ok(res,r.rows[0],201);
});
app.put('/api/admin-users', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const { id } = req.query;
  const { full_name, email, role: rl, class: cls, is_active } = req.body;
  const r = await q(`UPDATE users SET full_name=COALESCE($1,full_name),email=COALESCE($2,email),role=COALESCE($3,role),class=COALESCE($4,class),is_active=COALESCE($5,is_active),updated_at=NOW() WHERE id=$6 RETURNING id,full_name,email,role,class,is_active`,[full_name,email,rl,cls,is_active,id]);
  ok(res,r.rows[0]);
});
app.delete('/api/admin-users', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  await q('UPDATE users SET is_active=false WHERE id=$1',[req.query.id]);
  ok(res,{message:'Deactivated'});
});

// ─── ADMIN: SUBJECTS ──────────────────────────────────────────────────────────
app.get('/api/admin-subjects', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  ok(res,(await q(`SELECT s.*,u.full_name teacher_name FROM subjects s LEFT JOIN users u ON s.teacher_id=u.id ORDER BY s.name`)).rows);
});
app.post('/api/admin-subjects', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const { name,code,class_level,teacher_id,description } = req.body;
  const r = await q('INSERT INTO subjects(name,code,class_level,teacher_id,description)VALUES($1,$2,$3,$4,$5)RETURNING *',[name,code,class_level,teacher_id||null,description||null]);
  ok(res,r.rows[0],201);
});
app.put('/api/admin-subjects', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const { id } = req.query;
  const { name,code,class_level,teacher_id,description } = req.body;
  const r = await q(`UPDATE subjects SET name=COALESCE($1,name),code=COALESCE($2,code),class_level=COALESCE($3,class_level),teacher_id=COALESCE($4,teacher_id),description=COALESCE($5,description) WHERE id=$6 RETURNING *`,[name,code,class_level,teacher_id||null,description||null,id]);
  ok(res,r.rows[0]);
});
app.delete('/api/admin-subjects', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  await q('DELETE FROM subjects WHERE id=$1',[req.query.id]);
  ok(res,{message:'Deleted'});
});

// ─── ADMIN: STATS & RESULTS ───────────────────────────────────────────────────
app.get('/api/admin-stats', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const [users, exams, attempts, subjects] = await Promise.all([
    q("SELECT role,COUNT(*) c FROM users WHERE is_active=true GROUP BY role"),
    q("SELECT status,COUNT(*) c FROM exams GROUP BY status"),
    q("SELECT COUNT(*) c,AVG(percentage) avg FROM exam_attempts WHERE status='submitted'"),
    q("SELECT COUNT(*) c FROM subjects"),
  ]);
  const ud={total:0,admin:0,teacher:0,student:0};
  users.rows.forEach(r=>{ud[r.role]=+r.c;ud.total+=+r.c;});
  const ed={total:0,active:0,draft:0,completed:0,published:0};
  exams.rows.forEach(r=>{ed[r.status]=+r.c;ed.total+=+r.c;});
  ok(res,{users:ud,exams:ed,attempts:{total:+attempts.rows[0].c,avg_score:(+attempts.rows[0].avg||0).toFixed(1)},subjects:+subjects.rows[0].c});
});
app.get('/api/admin-results', async (req, res) => {
  const u = await role(req,res,'admin'); if (!u) return;
  const r = await q(`SELECT ea.*,u.full_name student_name,u.class,e.title exam_title,s.name subject_name FROM exam_attempts ea JOIN users u ON ea.student_id=u.id JOIN exams e ON ea.exam_id=e.id LEFT JOIN subjects s ON e.subject_id=s.id WHERE ea.status='submitted' ORDER BY ea.submitted_at DESC LIMIT 200`);
  ok(res,r.rows);
});

// ─── EXAMS ────────────────────────────────────────────────────────────────────
app.get('/api/exams', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const { id, action } = req.query;

  if (!id) {
    let sql,params=[];
    if (u.role==='student') {
      sql=`SELECT e.*,s.name subject_name,u.full_name teacher_name,(SELECT COUNT(*) FROM questions WHERE exam_id=e.id) question_count,(SELECT id FROM exam_attempts WHERE exam_id=e.id AND student_id=$1 AND status='submitted' LIMIT 1) attempt_id,(SELECT percentage FROM exam_attempts WHERE exam_id=e.id AND student_id=$1 AND status='submitted' LIMIT 1) my_score FROM exams e LEFT JOIN subjects s ON e.subject_id=s.id LEFT JOIN users u ON e.teacher_id=u.id WHERE e.status IN('published','active','completed') AND e.class_level=$2 ORDER BY e.created_at DESC`;
      params=[u.id,u.class];
    } else if (u.role==='teacher') {
      sql=`SELECT e.*,s.name subject_name,(SELECT COUNT(*) FROM questions WHERE exam_id=e.id) question_count,(SELECT COUNT(*) FROM exam_attempts WHERE exam_id=e.id AND status='submitted') submissions FROM exams e LEFT JOIN subjects s ON e.subject_id=s.id WHERE e.teacher_id=$1 ORDER BY e.created_at DESC`;
      params=[u.id];
    } else {
      sql=`SELECT e.*,s.name subject_name,u.full_name teacher_name,(SELECT COUNT(*) FROM questions WHERE exam_id=e.id) question_count,(SELECT COUNT(*) FROM exam_attempts WHERE exam_id=e.id AND status='submitted') submissions FROM exams e LEFT JOIN subjects s ON e.subject_id=s.id LEFT JOIN users u ON e.teacher_id=u.id ORDER BY e.created_at DESC`;
    }
    return ok(res,(await q(sql,params)).rows);
  }

  if (id && !action) {
    const r = await q(`SELECT e.*,s.name subject_name,u.full_name teacher_name FROM exams e LEFT JOIN subjects s ON e.subject_id=s.id LEFT JOIN users u ON e.teacher_id=u.id WHERE e.id=$1`,[id]);
    if (!r.rows[0]) return err(res,'Exam not found',404);
    const exam = r.rows[0];
    const qs = await q('SELECT * FROM questions WHERE exam_id=$1 ORDER BY order_index',[id]);
    let questions = qs.rows;
    if (u.role==='student' && exam.status==='active') {
      questions = questions.map(({correct_answer,explanation,...q2})=>q2);
    }
    return ok(res,{...exam,questions});
  }

  if (id && action==='results') {
    if (!['teacher','admin'].includes(u.role)) return err(res,'Forbidden',403);
    const r = await q(`SELECT ea.*,u.full_name student_name,u.student_id student_no,u.class FROM exam_attempts ea JOIN users u ON ea.student_id=u.id WHERE ea.exam_id=$1 AND ea.status='submitted' ORDER BY ea.percentage DESC`,[id]);
    return ok(res,r.rows);
  }
});

app.post('/api/exams', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const { id, action } = req.query;

  if (!id) {
    if (!['teacher','admin'].includes(u.role)) return err(res,'Forbidden',403);
    const { title,subject_id,class_level,instructions,duration_minutes,pass_mark,show_results_immediately,max_attempts,randomize_questions } = req.body;
    const r = await q(`INSERT INTO exams(title,subject_id,teacher_id,class_level,instructions,duration_minutes,pass_mark,show_results_immediately,max_attempts,randomize_questions)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)RETURNING *`,[title,subject_id||null,u.id,class_level,instructions||null,duration_minutes||60,pass_mark||50,show_results_immediately!==false,max_attempts||1,randomize_questions||false]);
    return ok(res,r.rows[0],201);
  }

  if (id && action==='publish') {
    if (!['teacher','admin'].includes(u.role)) return err(res,'Forbidden',403);
    const qs = await q('SELECT COUNT(*) c FROM questions WHERE exam_id=$1',[id]);
    if (+qs.rows[0].c===0) return err(res,'Add at least one question before publishing');
    const r = await q("UPDATE exams SET status='published',updated_at=NOW() WHERE id=$1 RETURNING *",[id]);
    const subs = await q("SELECT DISTINCT student_id FROM exam_attempts WHERE exam_id=$1 UNION SELECT u.id FROM users u WHERE u.class=(SELECT class_level FROM exams WHERE id=$1) AND u.role='student' LIMIT 50",[id]);
    if (subs.rows.length) {
      const vals = subs.rows.map((_,i)=>`($${i*3+1},$${i*3+2},$${i*3+3},'exam')`).join(',');
      const params = subs.rows.flatMap(s=>[s.student_id||s.id,`New Exam: ${r.rows[0].title}`,`A new exam has been published for your class.`]);
      if (params.length) await q(`INSERT INTO notifications(user_id,title,message,type)VALUES ${vals}`,params);
    }
    return ok(res,r.rows[0]);
  }

  if (id && action==='questions') {
    if (!['teacher','admin'].includes(u.role)) return err(res,'Forbidden',403);
    const { question_text,question_type,options,correct_answer,marks,explanation } = req.body;
    const mo = await q('SELECT COALESCE(MAX(order_index),0) m FROM questions WHERE exam_id=$1',[id]);
    const r = await q(`INSERT INTO questions(exam_id,question_text,question_type,options,correct_answer,marks,explanation,order_index)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *`,[id,question_text,question_type||'mcq',options?JSON.stringify(options):null,correct_answer,marks||1,explanation||null,+mo.rows[0].m+1]);
    const tot = await q('SELECT SUM(marks) s FROM questions WHERE exam_id=$1',[id]);
    await q('UPDATE exams SET total_marks=$1,updated_at=NOW() WHERE id=$2',[tot.rows[0].s,id]);
    return ok(res,r.rows[0],201);
  }
});

app.put('/api/exams', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const { id, action, qid } = req.query;
  if (!['teacher','admin'].includes(u.role)) return err(res,'Forbidden',403);

  if (!action) {
    const { title,subject_id,class_level,instructions,duration_minutes,pass_mark,show_results_immediately,max_attempts,randomize_questions } = req.body;
    const r = await q(`UPDATE exams SET title=COALESCE($1,title),subject_id=COALESCE($2,subject_id),class_level=COALESCE($3,class_level),instructions=COALESCE($4,instructions),duration_minutes=COALESCE($5,duration_minutes),pass_mark=COALESCE($6,pass_mark),show_results_immediately=COALESCE($7,show_results_immediately),max_attempts=COALESCE($8,max_attempts),randomize_questions=COALESCE($9,randomize_questions),updated_at=NOW() WHERE id=$10 RETURNING *`,[title,subject_id||null,class_level,instructions,duration_minutes,pass_mark,show_results_immediately,max_attempts,randomize_questions,id]);
    return ok(res,r.rows[0]);
  }

  if (action==='questions' && qid) {
    const { question_text,options,correct_answer,marks,explanation } = req.body;
    const r = await q(`UPDATE questions SET question_text=COALESCE($1,question_text),options=COALESCE($2,options),correct_answer=COALESCE($3,correct_answer),marks=COALESCE($4,marks),explanation=COALESCE($5,explanation) WHERE id=$6 AND exam_id=$7 RETURNING *`,[question_text,options?JSON.stringify(options):null,correct_answer,marks,explanation,qid,id]);
    return ok(res,r.rows[0]);
  }
});

app.delete('/api/exams', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const { id, action, qid } = req.query;
  if (!['teacher','admin'].includes(u.role)) return err(res,'Forbidden',403);
  if (action==='questions' && qid) {
    await q('DELETE FROM questions WHERE id=$1 AND exam_id=$2',[qid,id]);
    const tot = await q('SELECT COALESCE(SUM(marks),0) s FROM questions WHERE exam_id=$1',[id]);
    await q('UPDATE exams SET total_marks=$1,updated_at=NOW() WHERE id=$2',[tot.rows[0].s,id]);
    return ok(res,{message:'Deleted'});
  }
  await q('DELETE FROM exams WHERE id=$1',[id]);
  ok(res,{message:'Deleted'});
});

// ─── ATTEMPTS ────────────────────────────────────────────────────────────────
app.get('/api/attempts', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const { id, action } = req.query;

  if (action==='history') {
    const r = await q(`SELECT ea.*,e.title exam_title,e.duration_minutes,s.name subject_name FROM exam_attempts ea JOIN exams e ON ea.exam_id=e.id LEFT JOIN subjects s ON e.subject_id=s.id WHERE ea.student_id=$1 ORDER BY ea.created_at DESC`,[u.id]);
    return ok(res,r.rows);
  }

  if (id && action==='result') {
    const r = await q(`SELECT ea.*,e.title exam_title,e.show_results_immediately,s.name subject_name FROM exam_attempts ea JOIN exams e ON ea.exam_id=e.id LEFT JOIN subjects s ON e.subject_id=s.id WHERE ea.id=$1`,[id]);
    if (!r.rows[0]) return err(res,'Result not found',404);
    const att = r.rows[0];
    if (u.role==='student' && att.student_id!==u.id) return err(res,'Forbidden',403);
    let questions=[];
    if (att.show_results_immediately || u.role!=='student') {
      questions=(await q('SELECT * FROM questions WHERE exam_id=$1 ORDER BY order_index',[att.exam_id])).rows;
    }
    return ok(res,{...att,questions});
  }
});

app.post('/api/attempts', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const { id, action } = req.query;

  if (action==='start') {
    if (u.role!=='student') return err(res,'Students only',403);
    const { exam_id } = req.body;
    const examR = await q("SELECT * FROM exams WHERE id=$1 AND status IN('published','active')",[exam_id]);
    if (!examR.rows[0]) return err(res,'Exam not available',404);
    const exam = examR.rows[0];
    if (exam.class_level!==u.class) return err(res,'Exam not available for your class',403);
    const prev = await q("SELECT COUNT(*) c FROM exam_attempts WHERE exam_id=$1 AND student_id=$2 AND status='submitted'",[exam_id,u.id]);
    if (+prev.rows[0].c>=exam.max_attempts) return err(res,'Maximum attempts reached');
    const inProg = await q("SELECT * FROM exam_attempts WHERE exam_id=$1 AND student_id=$2 AND status='in_progress'",[exam_id,u.id]);
    if (inProg.rows[0]) return ok(res,{attempt:inProg.rows[0],resumed:true});
    await q("UPDATE exams SET status='active' WHERE id=$1 AND status='published'",[exam_id]);
    const r = await q('INSERT INTO exam_attempts(exam_id,student_id)VALUES($1,$2)RETURNING *',[exam_id,u.id]);
    return ok(res,{attempt:r.rows[0],resumed:false},201);
  }

  if (id && action==='submit') {
    if (u.role!=='student') return err(res,'Students only',403);
    const attR = await q("SELECT * FROM exam_attempts WHERE id=$1 AND student_id=$2 AND status='in_progress'",[id,u.id]);
    if (!attR.rows[0]) return err(res,'No active attempt',404);
    const att = attR.rows[0];
    const [qsR,examR] = await Promise.all([q('SELECT * FROM questions WHERE exam_id=$1',[att.exam_id]),q('SELECT * FROM exams WHERE id=$1',[att.exam_id])]);
    const exam = examR.rows[0];
    const finalAnswers = req.body.answers||att.answers||{};
    let score=0; const graded={};
    qsR.rows.forEach(q2=>{
      const sa=(finalAnswers[q2.id]||'').toString().trim().toLowerCase();
      const ca=q2.correct_answer.toString().trim().toLowerCase();
      const correct=sa===ca;
      if (correct) score+=q2.marks;
      graded[q2.id]={student_answer:finalAnswers[q2.id]||null,correct_answer:q2.correct_answer,is_correct:correct,marks_awarded:correct?q2.marks:0,marks_possible:q2.marks};
    });
    const pct=exam.total_marks>0?(score/exam.total_marks)*100:0;
    const grade=calcGrade(pct);
    const mins=Math.round((Date.now()-new Date(att.started_at).getTime())/60000);
    const r = await q(`UPDATE exam_attempts SET submitted_at=NOW(),status='submitted',answers=$1,score=$2,total_marks=$3,percentage=$4,grade=$5,time_taken_minutes=$6 WHERE id=$7 RETURNING *`,[JSON.stringify(graded),score,exam.total_marks,pct.toFixed(2),grade,mins,id]);
    await q("UPDATE exams SET status='completed' WHERE id=$1 AND status='active'",[att.exam_id]);
    await q("INSERT INTO notifications(user_id,title,message,type)VALUES($1,$2,$3,'success')",[u.id,'Exam Submitted!',`Score: ${score}/${exam.total_marks} (${pct.toFixed(1)}%) — Grade ${grade}`]);
    return ok(res,{attempt:r.rows[0],show_results:exam.show_results_immediately,questions:exam.show_results_immediately?qsR.rows:[]});
  }
});

app.put('/api/attempts', async (req, res) => {
  const u = await auth(req,res); if (!u) return;
  const { id, action } = req.query;
  if (action==='answer') {
    if (u.role!=='student') return err(res,'Students only',403);
    const { question_id, answer } = req.body;
    const attR = await q("SELECT * FROM exam_attempts WHERE id=$1 AND student_id=$2 AND status='in_progress'",[id,u.id]);
    if (!attR.rows[0]) return err(res,'No active attempt',404);
    const answers={...(attR.rows[0].answers||{}),[question_id]:answer};
    await q('UPDATE exam_attempts SET answers=$1 WHERE id=$2',[JSON.stringify(answers),id]);
    return ok(res,{saved:true});
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({status:'GSS Gadau Exam API ✅',ts:new Date().toISOString()}));
app.get('/api/init',   async (_req, res) => { try { await initDB(); res.json({ok:true}); } catch(e){ res.status(500).json({error:e.message}); } });

// ─── Serve React build ────────────────────────────────────────────────────────
const DIST = path.join(__dirname, 'dist');
app.use(express.static(DIST));
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
initDB().then(() => {
  app.listen(PORT, () => console.log(`GSS Gadau Exam System running on port ${PORT}`));
}).catch(e => { console.error('Startup error:', e.message); process.exit(1); });
