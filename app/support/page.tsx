'use client';

import { useState } from 'react';

type SupportForm = {
  customer_name: string;
  customer_phone: string;
  machine_id: string;
  location: string;
  issue_type: string;
  payment_amount: string;
  payment_channel: string;
  transaction_time: string;
  description: string;
};

type ResultMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

type IssueResponse = {
  ok: boolean;
  message?: string;
  ticket?: {
    id: number;
  };
};

const issueTypes = [
  'จ่ายเงินแล้วน้ำแข็งไม่ออก',
  'ตู้ไม่ทำงาน',
  'น้ำแข็งออกไม่ครบ',
  'โอนเงินซ้ำ',
  'ตู้รับคำสั่งช้า',
  'อื่น ๆ',
];

const paymentChannels = [
  'QR Payment',
  'Ksher',
  'PromptPay',
  'Online Payment',
  'เงินสด/เหรียญ',
  'อื่น ๆ',
];

export default function SupportPage() {
  const defaultMachineId =
    process.env.NEXT_PUBLIC_DEFAULT_MACHINE_ID || '2';

  const defaultLocation =
    process.env.NEXT_PUBLIC_SUPPORT_LOCATION || 'Lotus Gofresh';

  const [form, setForm] = useState<SupportForm>({
    customer_name: '',
    customer_phone: '',
    machine_id: String(defaultMachineId),
    location: String(defaultLocation),
    issue_type: 'จ่ายเงินแล้วน้ำแข็งไม่ออก',
    payment_amount: '',
    payment_channel: 'QR Payment',
    transaction_time: '',
    description: '',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ResultMessage>(null);

  function updateField(name: keyof SupportForm, value: string) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const fd = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        fd.append(key, value);
      });

      const res = await fetch('/api/issues', {
        method: 'POST',
        body: fd,
      });

      const data = (await res.json()) as IssueResponse;

      if (!res.ok || !data.ok) {
        setResult({
          type: 'error',
          message: data.message || 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่',
        });
        return;
      }

      setResult({
        type: 'success',
        message: `รับเรื่องเรียบร้อยแล้ว หมายเลข Ticket #${data.ticket?.id || '-'}`,
      });

      setForm({
        customer_name: '',
        customer_phone: '',
        machine_id: String(defaultMachineId),
        location: String(defaultLocation),
        issue_type: 'จ่ายเงินแล้วน้ำแข็งไม่ออก',
        payment_amount: '',
        payment_channel: 'QR Payment',
        transaction_time: '',
        description: '',
      });
    } catch (err) {
      console.error(err);
      setResult({
        type: 'error',
        message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="support-page">
      <div className="card">
        <div className="brand">
          <div className="logo">🧊</div>
          <div>
            <h1>DeanIce Support</h1>
            <p>แจ้งปัญหาการใช้งานตู้ 24 ชั่วโมง</p>
          </div>
        </div>

        <div className="notice">
          หากจ่ายเงินแล้วน้ำแข็งไม่ออก กรุณากรอกเวลาโอน จำนวนเงิน
          และเลขอ้างอิง/รายละเอียดจากสลิป เพื่อให้ทีมงานตรวจสอบได้เร็วขึ้นครับ
        </div>

        {result && (
          <div
            className={
              result.type === 'success'
                ? 'alert alert-success'
                : 'alert alert-error'
            }
          >
            {result.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            ชื่อ / ชื่อเล่น
            <input
              value={form.customer_name}
              onChange={(e) =>
                updateField('customer_name', e.currentTarget.value)
              }
              placeholder="เช่น คุณเอ"
            />
          </label>

          <label>
            เบอร์โทรติดต่อ
            <input
              value={form.customer_phone}
              onChange={(e) =>
                updateField('customer_phone', e.currentTarget.value)
              }
              placeholder="เช่น 08x-xxx-xxxx"
              inputMode="tel"
            />
          </label>

          <div className="grid">
            <label>
              หมายเลขตู้
              <input
                value={form.machine_id}
                onChange={(e) =>
                  updateField('machine_id', e.currentTarget.value)
                }
                inputMode="numeric"
              />
            </label>

            <label>
              สถานที่
              <input
                value={form.location}
                onChange={(e) =>
                  updateField('location', e.currentTarget.value)
                }
              />
            </label>
          </div>

          <label>
            ประเภทปัญหา
            <select
              value={form.issue_type}
              onChange={(e) =>
                updateField('issue_type', e.currentTarget.value)
              }
              required
            >
              {issueTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div className="grid">
            <label>
              จำนวนเงิน
              <input
                value={form.payment_amount}
                onChange={(e) =>
                  updateField('payment_amount', e.currentTarget.value)
                }
                placeholder="เช่น 10, 20, 30"
                inputMode="decimal"
              />
            </label>

            <label>
              ช่องทางชำระเงิน
              <select
                value={form.payment_channel}
                onChange={(e) =>
                  updateField('payment_channel', e.currentTarget.value)
                }
              >
                {paymentChannels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            เวลาที่ทำรายการ / เวลาที่โอน
            <input
              type="datetime-local"
              value={form.transaction_time}
              onChange={(e) =>
                updateField('transaction_time', e.currentTarget.value)
              }
            />
          </label>

          <label>
            รายละเอียดจากสลิป / เลขอ้างอิง / หมายเหตุเพิ่มเติม
            <textarea
              value={form.description}
              onChange={(e) =>
                updateField('description', e.currentTarget.value)
              }
              placeholder="เช่น โอนเวลา 21:35 จำนวน 10 บาท, Ref: 123456, สแกนจ่ายแล้วแต่น้ำแข็งไม่ออก"
              rows={5}
            />
            <small>
              ไม่ต้องอัปโหลดรูปก็ได้ครับ กรุณากรอกข้อมูลจากสลิปให้มากที่สุด
            </small>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'กำลังส่งข้อมูล...' : 'ส่งเรื่องให้ทีมงาน'}
          </button>
        </form>

        <p className="footer-note">
          ระบบจะบันทึกเรื่องไว้ให้ทีมงานตรวจสอบ
          และติดต่อกลับตามข้อมูลที่แจ้งไว้
        </p>
      </div>

      <style jsx>{`
        .support-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #fff7ed, #f8fafc);
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          color: #111827;
        }

        .card {
          width: 100%;
          max-width: 680px;
          background: #ffffff;
          border-radius: 24px;
          padding: 28px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
          border: 1px solid #fed7aa;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .logo {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: linear-gradient(135deg, #f97316, #fb923c);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          box-shadow: 0 10px 25px rgba(249, 115, 22, 0.35);
        }

        h1 {
          margin: 0;
          font-size: 28px;
          color: #111827;
        }

        p {
          margin: 4px 0 0;
          color: #6b7280;
        }

        .notice {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 18px;
          line-height: 1.55;
          font-weight: 700;
        }

        .alert {
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
          font-weight: 700;
        }

        .alert-success {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .alert-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          font-weight: 700;
          color: #374151;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 14px;
          padding: 13px 14px;
          font-size: 16px;
          outline: none;
          background: #ffffff;
          box-sizing: border-box;
          color: #111827;
          font-weight: 600;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.12);
        }

        textarea {
          resize: vertical;
        }

        small {
          color: #6b7280;
          font-weight: 400;
          line-height: 1.45;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        button {
          margin-top: 8px;
          border: none;
          border-radius: 16px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          padding: 15px 18px;
          font-size: 17px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(249, 115, 22, 0.35);
        }

        button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .footer-note {
          text-align: center;
          margin-top: 18px;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .support-page {
            padding: 14px;
            align-items: flex-start;
          }

          .card {
            padding: 20px;
            border-radius: 20px;
          }

          .grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </main>
  );
}