// app/api/issues/[id]/route.js

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOW_STATUS = [
  'OPEN',
  'CHECKING',
  'REFUNDED',
  'RESOLVED',
  'REJECTED',
];

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

export async function PATCH(req, context) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const id = context?.params?.id;
    const body = await req.json();

    const pin = cleanText(body.pin);
    const status = cleanText(body.status);
    const admin_note = cleanText(body.admin_note);

    if (pin !== process.env.SUPPORT_ADMIN_PIN) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Missing ticket id',
        },
        { status: 400 }
      );
    }

    if (!ALLOW_STATUS.includes(status)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Invalid status',
        },
        { status: 400 }
      );
    }

    const updatePayload = {
      status,
      admin_note,
      updated_at: new Date().toISOString(),
    };

    if (['REFUNDED', 'RESOLVED', 'REJECTED'].includes(status)) {
      updatePayload.resolved_at = new Date().toISOString();
    } else {
      updatePayload.resolved_at = null;
    }

    const { data, error } = await supabaseAdmin
      .from('customer_issue_ticket')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Update customer_issue_ticket failed:', error);

      return NextResponse.json(
        {
          ok: false,
          message: `อัปเดตไม่สำเร็จ: ${error.message}`,
          detail: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'อัปเดตสำเร็จ',
      data,
    });
  } catch (err) {
    console.error('PATCH /api/issues/[id] failed:', err);

    return NextResponse.json(
      {
        ok: false,
        message: `ระบบขัดข้อง: ${err?.message || 'unknown error'}`,
      },
      { status: 500 }
    );
  }
}