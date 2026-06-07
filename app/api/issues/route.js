// app/api/issues/route.js

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function cleanText(value) {
  if (!value) return null;
  return String(value).trim() || null;
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildTelegramMessage(ticket) {
  return `
🚨 DeanIce Customer Issue

สถานะ: ${ticket.status}
Ticket ID: #${ticket.id}

ตู้: Machine ${ticket.machine_id || '-'} - ${ticket.location || '-'}
ปัญหา: ${ticket.issue_type || '-'}
จำนวนเงิน: ${ticket.payment_amount || '-'} บาท
ช่องทางชำระเงิน: ${ticket.payment_channel || '-'}

ลูกค้า: ${ticket.customer_name || '-'}
โทร: ${ticket.customer_phone || '-'}

เวลาที่ลูกค้าแจ้งว่าเกิดปัญหา:
${ticket.transaction_time || '-'}

รายละเอียด:
${ticket.description || '-'}

สลิป/รูป:
${ticket.slip_url || '-'}

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

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Telegram send failed:', errText);
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();

    const customer_name = cleanText(formData.get('customer_name'));
    const customer_phone = cleanText(formData.get('customer_phone'));
    const machine_id = cleanNumber(formData.get('machine_id'));
    const location = cleanText(formData.get('location'));

    const issue_type = cleanText(formData.get('issue_type'));
    const payment_amount = cleanNumber(formData.get('payment_amount'));
    const payment_channel = cleanText(formData.get('payment_channel'));
    const transaction_time = cleanText(formData.get('transaction_time'));

    const description = cleanText(formData.get('description'));
    const file = formData.get('slip');

    if (!issue_type) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาเลือกประเภทปัญหา' },
        { status: 400 }
      );
    }

    let slip_url = null;

    if (file && typeof file === 'object' && file.size > 0) {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
      ];

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          {
            ok: false,
            message: 'รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ PDF',
          },
          { status: 400 }
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          {
            ok: false,
            message: 'ไฟล์ต้องมีขนาดไม่เกิน 5MB',
          },
          { status: 400 }
        );
      }

      const ext =
        file.type === 'application/pdf'
          ? 'pdf'
          : file.type === 'image/png'
          ? 'png'
          : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';

      const fileName = `issue-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from('issue-slips')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload slip failed:', uploadError);
        return NextResponse.json(
          {
            ok: false,
            message: 'อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่',
          },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('issue-slips')
        .getPublicUrl(fileName);

      slip_url = publicUrlData?.publicUrl || null;
    }

    const payload = {
      customer_name,
      customer_phone,
      machine_id,
      location,
      issue_type,
      payment_amount,
      payment_channel,
      transaction_time: transaction_time || null,
      slip_url,
      description,
      status: 'OPEN',
    };

    const { data, error } = await supabaseAdmin
      .from('customer_issue_ticket')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Insert issue failed:', error);
      return NextResponse.json(
        {
          ok: false,
          message: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่',
        },
        { status: 500 }
      );
    }

    await sendTelegram(buildTelegramMessage(data));

    return NextResponse.json({
      ok: true,
      message: 'รับเรื่องเรียบร้อยแล้ว',
      ticket: data,
    });
  } catch (err) {
    console.error('POST /api/issues failed:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
      },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
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
      console.error('Fetch issues failed:', error);
      return NextResponse.json(
        {
          ok: false,
          message: 'โหลดข้อมูลไม่สำเร็จ',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('GET /api/issues failed:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'ระบบขัดข้อง',
      },
      { status: 500 }
    );
  }
}