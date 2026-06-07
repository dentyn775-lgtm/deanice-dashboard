// app/api/issues/[id]/route.js

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const ALLOW_STATUS = [
  'OPEN',
  'CHECKING',
  'REFUNDED',
  'RESOLVED',
  'REJECTED',
];

export async function PATCH(req, context) {
  try {
    const id = context.params.id;
    const body = await req.json();

    const pin = body.pin;
    const status = body.status;
    const admin_note = body.admin_note || null;

    if (pin !== process.env.SUPPORT_ADMIN_PIN) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Unauthorized',
        },
        { status: 401 }
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
    }

    const { data, error } = await supabaseAdmin
      .from('customer_issue_ticket')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update issue failed:', error);
      return NextResponse.json(
        {
          ok: false,
          message: 'อัปเดตไม่สำเร็จ',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('PATCH /api/issues/[id] failed:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'ระบบขัดข้อง',
      },
      { status: 500 }
    );
  }
}