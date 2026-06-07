'use client';

import { useEffect, useState } from 'react';

type TicketStatus = 'OPEN' | 'CHECKING' | 'REFUNDED' | 'RESOLVED' | 'REJECTED';
type StatusFilter = TicketStatus | 'ALL';

type Ticket = {
  id: number;
  created_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  machine_id: number | string | null;
  location: string | null;
  issue_type: string | null;
  payment_amount: number | string | null;
  payment_channel: string | null;
  transaction_time: string | null;
  slip_url: string | null;
  description: string | null;
  status: TicketStatus;
  admin_note: string | null;
  resolved_at: string | null;
  updated_at?: string | null;
};

type IssueListResponse = {
  ok?: boolean;
  message?: string;
  data?: Ticket[];
};

type IssueUpdateResponse = {
  ok?: boolean;
  message?: string;
  data?: Ticket;
};

const statuses: StatusFilter[] = ['ALL', 'OPEN', 'CHECKING', 'REFUNDED', 'RESOLVED', 'REJECTED'];
const actionStatuses: TicketStatus[] = ['OPEN', 'CHECKING', 'REFUNDED', 'RESOLVED', 'REJECTED'];

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}

function statusClass(status: string | null | undefined): string {
  if (status === 'OPEN') return 'badge open';
  if (status === 'CHECKING') return 'badge checking';
  if (status === 'REFUNDED') return 'badge refunded';
  if (status === 'RESOLVED') return 'badge resolved';
  if (status === 'REJECTED') return 'badge rejected';
  return 'badge';
}

export default function SupportAdminPage() {
  const [pin, setPin] = useState<string>('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  async function loadTickets(): Promise<void> {
    if (!pin) {
      setMessage('กรุณากรอก Admin PIN');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(`/api/issues?pin=${encodeURIComponent(pin)}&status=${status}`);
      const data = (await res.json()) as IssueListResponse;

      if (!res.ok || !data.ok) {
        setMessage(data.message || 'โหลดข้อมูลไม่สำเร็จ');
        return;
      }

      setTickets(data.data || []);
    } catch (err) {
      console.error(err);
      setMessage('ระบบขัดข้อง');
    } finally {
      setLoading(false);
    }
  }

  async function updateTicket(id: number, newStatus: TicketStatus): Promise<void> {
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pin,
          status: newStatus,
          admin_note: adminNotes[id] || '',
        }),
      });

      const data = (await res.json()) as IssueUpdateResponse;

      if (!res.ok || !data.ok || !data.data) {
        setMessage(data.message || 'อัปเดตไม่สำเร็จ');
        return;
      }

      setTickets((prev) => prev.map((item) => (item.id === id ? data.data as Ticket : item)));
      setMessage(`อัปเดต Ticket #${id} เป็น ${newStatus} แล้ว`);
    } catch (err) {
      console.error(err);
      setMessage('ระบบขัดข้อง');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pin) {
      void loadTickets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openCount = tickets.filter((x) => x.status === 'OPEN').length;
  const checkingCount = tickets.filter((x) => x.status === 'CHECKING').length;
  const closedCount = tickets.filter((x) => ['REFUNDED', 'RESOLVED', 'REJECTED'].includes(x.status)).length;

  return (
    <main className="admin-page">
      <section className="panel">
        <div className="top">
          <div>
            <h1>DeanIce Support Admin</h1>
            <p>ดูรายการแจ้งปัญหาจากลูกค้า และอัปเดตสถานะการแก้ไข</p>
          </div>
          <div className="refresh">
            <button onClick={loadTickets} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="toolbar">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.currentTarget.value)}
            placeholder="Admin PIN"
          />

          <select value={status} onChange={(e) => setStatus(e.currentTarget.value as StatusFilter)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button onClick={loadTickets} disabled={loading}>
            ค้นหา
          </button>
        </div>

        {message && <div className="message">{message}</div>}

        <div className="kpis">
          <div className="kpi">
            <span>Open</span>
            <strong>{openCount}</strong>
          </div>
          <div className="kpi">
            <span>Checking</span>
            <strong>{checkingCount}</strong>
          </div>
          <div className="kpi">
            <span>Closed</span>
            <strong>{closedCount}</strong>
          </div>
          <div className="kpi">
            <span>Total Loaded</span>
            <strong>{tickets.length}</strong>
          </div>
        </div>

        <div className="ticket-list">
          {tickets.length === 0 ? (
            <div className="empty">ยังไม่มีข้อมูล หรือกรุณากดค้นหา</div>
          ) : (
            tickets.map((item) => (
              <article key={item.id} className="ticket-card">
                <div className="ticket-head">
                  <div>
                    <h2>Ticket #{item.id}</h2>
                    <p>{formatDate(item.created_at)}</p>
                  </div>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>

                <div className="ticket-grid">
                  <div>
                    <b>ปัญหา</b>
                    <span>{item.issue_type || '-'}</span>
                  </div>
                  <div>
                    <b>ตู้</b>
                    <span>
                      Machine {item.machine_id || '-'} / {item.location || '-'}
                    </span>
                  </div>
                  <div>
                    <b>จำนวนเงิน</b>
                    <span>{item.payment_amount || '-'} บาท</span>
                  </div>
                  <div>
                    <b>ช่องทาง</b>
                    <span>{item.payment_channel || '-'}</span>
                  </div>
                  <div>
                    <b>ลูกค้า</b>
                    <span>{item.customer_name || '-'}</span>
                  </div>
                  <div>
                    <b>โทร</b>
                    <span>{item.customer_phone || '-'}</span>
                  </div>
                  <div>
                    <b>เวลาทำรายการ</b>
                    <span>{formatDate(item.transaction_time)}</span>
                  </div>
                  <div>
                    <b>เวลาปิดเคส</b>
                    <span>{formatDate(item.resolved_at)}</span>
                  </div>
                </div>

                <div className="desc">
                  <b>รายละเอียด</b>
                  <p>{item.description || '-'}</p>
                </div>

                {item.slip_url && (
                  <a className="slip" href={item.slip_url} target="_blank" rel="noreferrer">
                    เปิดสลิป / รูปแนบ
                  </a>
                )}

                <div className="admin-action">
                  <textarea
                    value={adminNotes[item.id] !== undefined ? adminNotes[item.id] : item.admin_note || ''}
                    onChange={(e) =>
                      setAdminNotes((prev) => ({
                        ...prev,
                        [item.id]: e.currentTarget.value,
                      }))
                    }
                    placeholder="Admin note เช่น ตรวจสอบแล้ว คืนเงินแล้ว"
                    rows={3}
                  />

                  <div className="action-buttons">
                    {actionStatuses.map((s) => (
                      <button key={s} onClick={() => updateTicket(item.id, s)} disabled={loading}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <style jsx>{`
        .admin-page {
          min-height: 100vh;
          background: #f3f4f6;
          padding: 24px;
          font-family: Arial, sans-serif;
          color: #111827;
        }

        .panel {
          max-width: 1180px;
          margin: 0 auto;
        }

        .top {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: 30px;
        }

        p {
          margin: 4px 0 0;
          color: #6b7280;
        }

        .toolbar {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr 180px 120px;
          gap: 12px;
          margin-bottom: 14px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
        }

        input,
        select,
        textarea {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 12px 13px;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          width: 100%;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.12);
        }

        button {
          border: none;
          border-radius: 12px;
          background: #f97316;
          color: white;
          font-weight: 800;
          cursor: pointer;
          padding: 12px 14px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .message {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          padding: 12px 14px;
          border-radius: 14px;
          margin-bottom: 14px;
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .kpi {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e5e7eb;
          padding: 18px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
        }

        .kpi span {
          display: block;
          color: #6b7280;
          font-size: 13px;
        }

        .kpi strong {
          display: block;
          font-size: 30px;
          margin-top: 6px;
        }

        .ticket-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .empty {
          background: #ffffff;
          border: 1px dashed #d1d5db;
          border-radius: 18px;
          padding: 30px;
          text-align: center;
          color: #6b7280;
        }

        .ticket-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
        }

        .ticket-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        h2 {
          margin: 0;
          font-size: 22px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 95px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 900;
          background: #e5e7eb;
          color: #374151;
        }

        .open {
          background: #fef2f2;
          color: #991b1b;
        }

        .checking {
          background: #fffbeb;
          color: #92400e;
        }

        .refunded {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .resolved {
          background: #ecfdf5;
          color: #047857;
        }

        .rejected {
          background: #f3f4f6;
          color: #4b5563;
        }

        .ticket-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 14px;
        }

        .ticket-grid div {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
        }

        b {
          display: block;
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 5px;
        }

        span {
          color: #111827;
        }

        .desc {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .desc p {
          color: #111827;
          margin: 0;
          line-height: 1.5;
        }

        .slip {
          display: inline-block;
          margin-bottom: 12px;
          background: #111827;
          color: white;
          text-decoration: none;
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 800;
        }

        .admin-action {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .action-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .action-buttons button {
          background: #374151;
          font-size: 13px;
          padding: 10px 12px;
        }

        .action-buttons button:hover {
          background: #f97316;
        }

        @media (max-width: 900px) {
          .toolbar {
            grid-template-columns: 1fr;
          }

          .kpis {
            grid-template-columns: repeat(2, 1fr);
          }

          .ticket-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .top {
            flex-direction: column;
            align-items: stretch;
          }
        }

        @media (max-width: 560px) {
          .admin-page {
            padding: 14px;
          }

          .kpis,
          .ticket-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
