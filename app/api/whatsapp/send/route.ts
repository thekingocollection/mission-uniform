import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../lib/server-supabase';

export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { topic, templateParams = [] } = await req.json();
  if (!['daily_test','job_alerts','weekly_results'].includes(topic)) return NextResponse.json({ error: 'Invalid notification topic.' }, { status: 400 });
  const token = process.env.WHATSAPP_ACCESS_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID, template = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!token || !phoneId || !template) return NextResponse.json({ error: 'WhatsApp Cloud API is not configured.' }, { status: 503 });
  const db = getServiceSupabase();
  const { data: subscribers, error } = await db.from('whatsapp_subscriptions').select('phone,user_id').eq('is_active', true).contains('topics', [topic]).limit(500);
  if (error) return NextResponse.json({ error: 'Could not load subscribers.' }, { status: 500 });
  let sent = 0, failed = 0;
  for (const s of subscribers || []) {
    const result = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: s.phone, type: 'template', template: { name: template, language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' }, components: templateParams.length ? [{ type: 'body', parameters: templateParams.map((text: string) => ({ type: 'text', text: String(text).slice(0, 200) })) }] : [] } }) });
    if (result.ok) sent++; else failed++;
  }
  return NextResponse.json({ attempted: (subscribers || []).length, sent, failed });
}
