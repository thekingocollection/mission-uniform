import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../lib/server-supabase';

export async function POST(req: NextRequest) {
  try {
    const { phone, userId, consent, topics } = await req.json();
    const normalized = String(phone || '').replace(/\D/g, '');
    if (!consent) return NextResponse.json({ error: 'WhatsApp consent is required.' }, { status: 400 });
    if (!/^[6-9]\d{9}$/.test(normalized)) return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number.' }, { status: 400 });
    if (!userId) return NextResponse.json({ error: 'Please sign in before subscribing.' }, { status: 401 });
    const supabase = getServiceSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    if (authError || !user || user.id !== userId) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const { error } = await supabase.from('whatsapp_subscriptions').upsert({ user_id: userId, phone: `91${normalized}`, topics: Array.isArray(topics) ? topics.filter((t: string) => ['daily_test','job_alerts','weekly_results'].includes(t)) : ['daily_test'], consent_at: new Date().toISOString(), is_active: true }, { onConflict: 'user_id' });
    if (error) throw error;
    return NextResponse.json({ ok: true, message: 'Your WhatsApp preferences have been saved.' });
  } catch (e: any) { return NextResponse.json({ error: e.message || 'Could not save WhatsApp preferences.' }, { status: 500 }); }
}
