import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../lib/server-supabase';

export const runtime = 'nodejs';
const SYSTEM = `You are MISSION UNIFORM OP's exam-preparation tutor. Help students prepare for Indian government exams, especially Odisha Police. Reply in the language used by the student (Hindi, Odia, or English). Explain concepts simply, show steps for maths/reasoning, and create practice questions when requested. Never claim an answer is official unless a source is supplied. If uncertain about a current fact, say it needs verification. Do not help during a live timed test or provide leaked exam papers. Keep answers educational and concise.`;

export async function POST(req: NextRequest) {
  try {
    const token = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Please sign in to use the AI Study Assistant.' }, { status: 401 });
    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: 'Your session expired. Please sign in again.' }, { status: 401 });
    const { count } = await db.from('ai_assistant_usage').select('id', { count: 'exact', head: true }).eq('user_id', authData.user.id).gte('created_at', new Date(Date.now()-24*60*60*1000).toISOString());
    if ((count || 0) >= 30) return NextResponse.json({ error: 'Daily AI limit reached (30 questions). Please continue tomorrow.' }, { status: 429 });
    await db.from('ai_assistant_usage').insert({ user_id: authData.user.id });
    const body = await req.json();
    const message = String(body.message || '').trim();
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    if (!message || message.length > 4000) return NextResponse.json({ error: 'Enter a question up to 4,000 characters.' }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'AI assistant is not configured yet. Admin must add OPENAI_API_KEY.' }, { status: 503 });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.35, max_tokens: 900,
        messages: [{ role: 'system', content: SYSTEM }, ...history.filter((m: any) => ['user','assistant'].includes(m.role)).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) })), { role: 'user', content: message }] })
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: 'AI provider request failed. Please try again later.' }, { status: 502 });
    return NextResponse.json({ answer: data.choices?.[0]?.message?.content || 'I could not prepare an answer. Please try again.' });
  } catch { return NextResponse.json({ error: 'Unable to process your question.' }, { status: 500 }); }
}
