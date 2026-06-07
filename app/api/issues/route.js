// app/api/issues/route.js

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function cleanDateTime(value) {
  const text = cleanText(value);
  if (!text) return null;

  const d = new Date(text);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
}

function buildTelegramMessage(ticket) {
  return `
🚨 DeanIce Customer Issue

สถานะ: ${ticket.status || '-'}
Ticket ID: #${ticket.id || '-'}

ตู้: Machine ${ticket.machine_id || '-'} - ${ticket.location || '-'}
ปัญหา: ${ticket.issue_type || '-'}
จำนวนเงิน: ${ticket.payment_amount || '-'} บาท
ช่องทางชำระเงิน: ${ticket.payment_channel || '-'}

ลูกค้า: ${ticket.customer_name || '-'}
โทร: ${ticket.customer_phone || '-'}

เวลาที่ลูกค้าแจ้งว่าเกิดปัญหา:
${ticket.transaction_time || '-'}

รายละเอียด / Ref / หมายเหตุ:
${ticket.description || '-'}

Action:
ตรวจสอบรายการชำระเงิน / สถานะตู้ / พิจารณาคืนเงิน
`.trim();
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('Telegram env not configured');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Telegram send failed:', errText);
    }
  } catch (err) {
    console.error('Telegram error:', err);
  }
}

export async function POST(req) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const formData = await req.formData();

    const customer_name = cleanText(formData.get('customer_name'));
    const customer_phone = cleanText(formData.get('customer_phone'));
    const machine_id = cleanNumber(formData.get('machine_id'));
    const location = cleanText(formData.get('location'));

    const issue_type = cleanText(formData.get('issue_type'));
    const payment_amount = cleanNumber(formData.get('payment_amount'));
    const payment_channel = cleanText(formData.get('payment_channel'));
    const transaction_time = cleanDateTime(formData.get('transaction_time'));

    const description = cleanText(formData.get('description'));

    if (!issue_type) {
      return NextResponse.json(
        {
          ok: false,
          message: 'กรุณาเลือกประเภทปัญหา',
        },
        { status: 400 }
      );
    }

    const payload = {
      customer_name,
      customer_phone,
      machine_id,
      location,
      issue_type,
      payment_amount,
      payment_channel,
      transaction_time,
      slip_url: null,
      description,
      status: 'OPEN',
      admin_note: null,
      resolved_at: null,
      updated_at: new Date().toISOString(),
    };

    console.log('DeanIce issue payload:', payload);

    // Insert only: do not call .select().single()
    // This avoids requiring a SELECT RLS policy after insert.
    const { error } = await supabaseAdmin
      .from('customer_issue_ticket')
      .insert(payload);

    if (error) {
      console.error('Insert customer_issue_ticket failed:', error);

      return NextResponse.json(
        {
          ok: false,
          message: `บันทึกข้อมูลไม่สำเร็จ: ${error.message}`,
          detail: error,
        },
        { status: 500 }
      );
    }

    const telegramTicket = {
      ...payload,
      id: '-',
    };

    await sendTelegram(buildTelegramMessage(telegramTicket));

    return NextResponse.json({
      ok: true,
      message: 'รับเรื่องเรียบร้อยแล้ว',
      ticket: {
        id: '-',
      },
    });
  } catch (err) {
    console.error('POST /api/issues failed:', err);

    return NextResponse.json(
      {
        ok: false,
        message: `ระบบขัดข้อง: ${err?.message || 'unknown error'}`,
      },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const pin = searchParams.get('pin');
    const status = searchParams.get('status') || 'ALL';

    if (pin !== process.env.SUPPORT_ADMIN_PIN) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    let query = supabaseAdmin
      .from('customer_issue_ticket')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch customer_issue_ticket failed:', error);

      return NextResponse.json(
        {
          ok: false,
          message: `โหลดข้อมูลไม่สำเร็จ: ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: data || [],
    });
  } catch (err) {
    console.error('GET /api/issues failed:', err);

    return NextResponse.json(
      {
        ok: false,
        message: `ระบบขัดข้อง: ${err?.message || 'unknown error'}`,
      },
      { status: 500 }
    );
  }
}