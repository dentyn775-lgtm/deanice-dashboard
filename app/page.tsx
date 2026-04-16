'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

type Machine = {
  id: number;
  name: string;
  location: string | null;
  active: boolean | null;
};

type IncomeCoin = {
  id: number;
  machine_id: number;
  week_start: string;
  amount: number;
  note: string | null;
  created_at?: string | null;
};

type IncomeKsher = {
  id: number;
  machine_id: number;
  date: string;
  trans_amount: number;
  commission: number | null;
  credit_amount?: number | null;
  invoice_no: string | null;
  merchant_no?: string | null;
  raw_email: string | null;
  created_at?: string | null;
};

type Expense = {
  id: number;
  machine_id: number;
  category: string;
  amount: number;
  date: string;
  note: string | null;
  created_at?: string | null;
};

type RangeKey = '7d' | '30d' | 'month' | 'all';

export default function Page() {
  const [db, setDb] = useState<{
    machines: Machine[];
    income_coin: IncomeCoin[];
    income_ksher: IncomeKsher[];
    expenses: Expense[];
  }>({
    machines: [],
    income_coin: [],
    income_ksher: [],
    expenses: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selMachine, setSelMachine] = useState<number | null>(null);
  const [range, setRange] = useState<RangeKey>('30d');

  const [showCoinForm, setShowCoinForm] = useState(false);
  const [showKsherForm, setShowKsherForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const [coinForm, setCoinForm] = useState({
    machine_id: 1,
    week_start: today(),
    amount: '',
    note: '',
  });

  const [ksherForm, setKsherForm] = useState({
    machine_id: 1,
    date: today(),
    trans_amount: '',
    invoice_no: '',
    merchant_no: '',
    note: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    machine_id: 1,
    category: 'ค่าน้ำแข็ง',
    amount: '',
    date: today(),
    note: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (db.machines.length > 0) {
      const firstId = db.machines[0].id;
      setCoinForm(prev => ({ ...prev, machine_id: firstId }));
      setKsherForm(prev => ({ ...prev, machine_id: firstId }));
      setExpenseForm(prev => ({ ...prev, machine_id: firstId }));
    }
  }, [db.machines]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      const [
        { data: machines, error: e1 },
        { data: income_coin, error: e2 },
        { data: income_ksher, error: e3 },
        { data: expenses, error: e4 },
      ] = await Promise.all([
        supabase.from('machines').select('*').order('id'),
        supabase.from('income_coin').select('*').order('week_start', { ascending: false }),
        supabase.from('income_ksher').select('*').order('date', { ascending: false }),
        supabase.from('expenses').select('*').order('date', { ascending: false }),
      ]);

      if (e1 || e2 || e3 || e4) {
        throw new Error(e1?.message || e2?.message || e3?.message || e4?.message || 'Load data failed');
      }

      setDb({
        machines: (machines || []) as Machine[],
        income_coin: (income_coin || []) as IncomeCoin[],
        income_ksher: (income_ksher || []) as IncomeKsher[],
        expenses: (expenses || []) as Expense[],
      });
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function addCoin() {
    const { error } = await supabase.from('income_coin').insert({
      machine_id: Number(coinForm.machine_id),
      week_start: coinForm.week_start,
      amount: Number(coinForm.amount),
      note: coinForm.note,
    });

    if (error) {
      alert('บันทึกรายรับเหรียญไม่สำเร็จ: ' + error.message);
      return;
    }

    setShowCoinForm(false);
    setCoinForm(prev => ({ ...prev, amount: '', note: '' }));
    await loadData();
  }

  async function addKsherManual() {
    const invoice = ksherForm.invoice_no?.trim() || `MANUAL-${Date.now()}`;

    const { error } = await supabase.from('income_ksher').insert({
      machine_id: Number(ksherForm.machine_id),
      date: ksherForm.date,
      trans_amount: Number(ksherForm.trans_amount),
      commission: 0,
      credit_amount: Number(ksherForm.trans_amount),
      invoice_no: invoice,
      merchant_no: ksherForm.merchant_no?.trim() || null,
      raw_email: ksherForm.note || 'manual entry',
    });

    if (error) {
      alert('บันทึกรายรับ Ksher ไม่สำเร็จ: ' + error.message);
      return;
    }

    setShowKsherForm(false);
    setKsherForm(prev => ({ ...prev, trans_amount: '', invoice_no: '', merchant_no: '', note: '' }));
    await loadData();
  }

  async function addExpense() {
    const { error } = await supabase.from('expenses').insert({
      machine_id: Number(expenseForm.machine_id),
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      date: expenseForm.date,
      note: expenseForm.note,
    });

    if (error) {
      alert('บันทึกรายจ่ายไม่สำเร็จ: ' + error.message);
      return;
    }

    setShowExpenseForm(false);
    setExpenseForm(prev => ({ ...prev, amount: '', note: '' }));
    await loadData();
  }

  const machineFilteredKsher = useMemo(
    () => (selMachine ? db.income_ksher.filter(x => x.machine_id === selMachine) : db.income_ksher),
    [db.income_ksher, selMachine]
  );

  const machineFilteredCoin = useMemo(
    () => (selMachine ? db.income_coin.filter(x => x.machine_id === selMachine) : db.income_coin),
    [db.income_coin, selMachine]
  );

  const machineFilteredExp = useMemo(
    () => (selMachine ? db.expenses.filter(x => x.machine_id === selMachine) : db.expenses),
    [db.expenses, selMachine]
  );

  const rangeStart = useMemo(() => getRangeStart(range), [range]);
  const monthPrefix = today().slice(0, 7);

  const filteredKsher = useMemo(() => {
    return machineFilteredKsher.filter(row => inRange(row.date, range, rangeStart, monthPrefix));
  }, [machineFilteredKsher, range, rangeStart, monthPrefix]);

  const filteredCoin = useMemo(() => {
    return machineFilteredCoin.filter(row => inRange(row.week_start, range, rangeStart, monthPrefix));
  }, [machineFilteredCoin, range, rangeStart, monthPrefix]);

  const filteredExp = useMemo(() => {
    return machineFilteredExp.filter(row => inRange(row.date, range, rangeStart, monthPrefix));
  }, [machineFilteredExp, range, rangeStart, monthPrefix]);

  const totalKsher = filteredKsher.reduce((s, x) => s + Number(x.trans_amount || 0), 0);
  const totalCredit = filteredKsher.reduce((s, x) => s + Number(x.credit_amount || 0), 0);
  const totalCoin = filteredCoin.reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalExp = filteredExp.reduce((s, x) => s + Number(x.amount || 0), 0);

  const totalRevenue = totalKsher + totalCoin;
  const grossProfit = totalRevenue - totalExp;
  const conservativeProfit = totalCredit + totalCoin - totalExp;

  const todayStr = today();

  const todayKsher = machineFilteredKsher
    .filter(x => x.date === todayStr)
    .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

  const todayCoin = machineFilteredCoin
    .filter(x => x.week_start === todayStr)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const todayExp = machineFilteredExp
    .filter(x => x.date === todayStr)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const todayProfit = todayKsher + todayCoin - todayExp;

  const monthKsher = machineFilteredKsher
    .filter(x => (x.date || '').startsWith(monthPrefix))
    .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

  const monthCoin = machineFilteredCoin
    .filter(x => (x.week_start || '').startsWith(monthPrefix))
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const monthExp = machineFilteredExp
    .filter(x => (x.date || '').startsWith(monthPrefix))
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const monthProfit = monthKsher + monthCoin - monthExp;

  const totalTransactions = filteredKsher.length;
  const avgKsherPerTx = totalTransactions > 0 ? totalKsher / totalTransactions : 0;

  const chartDays = useMemo(() => {
    const n = range === '7d' ? 7 : 14;
    const days = buildLastNDays(n);

    return days.map(day => {
      const ksher = machineFilteredKsher
        .filter(x => x.date === day)
        .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

      const credit = machineFilteredKsher
        .filter(x => x.date === day)
        .reduce((s, x) => s + Number(x.credit_amount || 0), 0);

      const expense = machineFilteredExp
        .filter(x => x.date === day)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      const coin = machineFilteredCoin
        .filter(x => x.week_start === day)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      return {
        date: shortDate(day),
        ksher,
        credit,
        coin,
        expense,
        profit: ksher + coin - expense,
      };
    });
  }, [machineFilteredKsher, machineFilteredCoin, machineFilteredExp, range]);

  const monthChart = useMemo(() => {
    const map = new Map<string, { month: string; ksher: number; credit: number; coin: number; expense: number; profit: number }>();

    machineFilteredKsher.forEach(row => {
      const month = (row.date || '').slice(0, 7);
      if (!month) return;
      if (!map.has(month)) map.set(month, { month, ksher: 0, credit: 0, coin: 0, expense: 0, profit: 0 });
      map.get(month)!.ksher += Number(row.trans_amount || 0);
      map.get(month)!.credit += Number(row.credit_amount || 0);
    });

    machineFilteredCoin.forEach(row => {
      const month = (row.week_start || '').slice(0, 7);
      if (!month) return;
      if (!map.has(month)) map.set(month, { month, ksher: 0, credit: 0, coin: 0, expense: 0, profit: 0 });
      map.get(month)!.coin += Number(row.amount || 0);
    });

    machineFilteredExp.forEach(row => {
      const month = (row.date || '').slice(0, 7);
      if (!month) return;
      if (!map.has(month)) map.set(month, { month, ksher: 0, credit: 0, coin: 0, expense: 0, profit: 0 });
      map.get(month)!.expense += Number(row.amount || 0);
    });

    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(x => ({
        ...x,
        profit: x.ksher + x.coin - x.expense,
      }));
  }, [machineFilteredKsher, machineFilteredCoin, machineFilteredExp]);

  const machineRanking = useMemo(() => {
    const rows = db.machines.map(m => {
      const ksher = db.income_ksher
        .filter(x => x.machine_id === m.id)
        .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

      const credit = db.income_ksher
        .filter(x => x.machine_id === m.id)
        .reduce((s, x) => s + Number(x.credit_amount || 0), 0);

      const coin = db.income_coin
        .filter(x => x.machine_id === m.id)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      const exp = db.expenses
        .filter(x => x.machine_id === m.id)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      return {
        id: m.id,
        name: m.name,
        location: m.location || '-',
        ksher,
        credit,
        coin,
        exp,
        profit: ksher + coin - exp,
        netCreditProfit: credit + coin - exp,
      };
    });

    rows.sort((a, b) => b.profit - a.profit);
    return rows;
  }, [db]);

  const topMachine = machineRanking[0] || null;

const recentTransactions = useMemo(() => {
  const machineMap = new Map(db.machines.map(m => [m.id, m.location || '-']));

  const ksherRows = filteredKsher.map(row => ({
    key: `k-${row.id}`,
    type: 'Ksher',
    date: row.date,
    machine_id: row.machine_id,
    location: machineMap.get(row.machine_id) || '-',
    ref: row.invoice_no || '-',
    amount: Number(row.trans_amount || 0),
    sub: `Credit ฿${fmtNum(row.credit_amount || 0)} | M-${row.merchant_no || '-'}`,
  }));

  const coinRows = filteredCoin.map(row => ({
    key: `c-${row.id}`,
    type: 'Coin',
    date: row.week_start,
    machine_id: row.machine_id,
    location: machineMap.get(row.machine_id) || '-',
    ref: row.note || 'บันทึกรับเหรียญ',
    amount: Number(row.amount || 0),
    sub: 'รายรับเหรียญ',
  }));

  const expRows = filteredExp.map(row => ({
    key: `e-${row.id}`,
    type: 'Expense',
    date: row.date,
    machine_id: row.machine_id,
    location: machineMap.get(row.machine_id) || '-',
    ref: row.category || '-',
    amount: Number(row.amount || 0) * -1,
    sub: row.note || '',
  }));

  return [...ksherRows, ...coinRows, ...expRows]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 20);
}, [filteredKsher, filteredCoin, filteredExp, db.machines]);

  function fmt(n: number) {
    return Number(n || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

function exportCsv() {
  const rows = [
    ['type', 'date', 'machine_id', 'location', 'reference', 'amount', 'sub'],
    ...recentTransactions.map(r => [
      r.type,
      r.date,
      String(r.machine_id),
      safeCsv(r.location || '-'),
      safeCsv(r.ref),
      String(r.amount),
      safeCsv(r.sub),
    ]),
  ];

  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');

  // ใส่ UTF-8 BOM เพื่อให้ Excel อ่านภาษาไทยถูก
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deanice-dashboard-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerWrap}>
          <div>
            <h1 style={styles.title}>DeanIce Dashboard Pro</h1>
            <div style={styles.subtitle}>เชื่อม Supabase สำเร็จแล้ว · พร้อมใช้งานจริง</div>
          </div>

          <div style={styles.actionWrap}>
            <button onClick={loadData} style={btnDark}>Reload</button>
            <button onClick={exportCsv} style={btnSlate}>Export CSV</button>
            <button onClick={() => setShowCoinForm(true)} style={btnBlue}>+ รายรับเหรียญ</button>
            <button onClick={() => setShowKsherForm(true)} style={btnAmber}>+ รายรับ Ksher</button>
            <button onClick={() => setShowExpenseForm(true)} style={btnRed}>+ รายจ่าย</button>
          </div>
        </div>

        {loading && <Box>Loading...</Box>}
        {error && <Box bg="#7f1d1d">Error: {error}</Box>}

        <div style={styles.toolbarRow}>
          <div style={styles.filterRow}>
            <button
              onClick={() => setSelMachine(null)}
              style={{
                ...pillBtn,
                background: selMachine === null ? '#0ea5e9' : '#111827',
                color: selMachine === null ? '#000' : '#fff',
              }}
            >
              ทุกตู้
            </button>

            {db.machines.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelMachine(m.id)}
                style={{
                  ...pillBtn,
                  background: selMachine === m.id ? '#f59e0b' : '#111827',
                  color: selMachine === m.id ? '#000' : '#fff',
                }}
              >
                {m.name}
              </button>
            ))}
          </div>

          <div style={styles.filterRow}>
            <button onClick={() => setRange('7d')} style={{ ...pillBtn, background: range === '7d' ? '#22c55e' : '#111827', color: range === '7d' ? '#000' : '#fff' }}>7 วัน</button>
            <button onClick={() => setRange('30d')} style={{ ...pillBtn, background: range === '30d' ? '#22c55e' : '#111827', color: range === '30d' ? '#000' : '#fff' }}>30 วัน</button>
            <button onClick={() => setRange('month')} style={{ ...pillBtn, background: range === 'month' ? '#22c55e' : '#111827', color: range === 'month' ? '#000' : '#fff' }}>เดือนนี้</button>
            <button onClick={() => setRange('all')} style={{ ...pillBtn, background: range === 'all' ? '#22c55e' : '#111827', color: range === 'all' ? '#000' : '#fff' }}>ทั้งหมด</button>
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <KpiCard title="จำนวนตู้" value={String(db.machines.length)} sub={topMachine ? `Top: ${topMachine.name}` : '-'} />
          <KpiCard title="รายรับ Ksher" value={`฿${fmt(totalKsher)}`} sub={`เครดิตรวม ฿${fmt(totalCredit)}`} />
          <KpiCard title="รายรับเหรียญ" value={`฿${fmt(totalCoin)}`} sub="บันทึกจากทีมงาน" />
          <KpiCard title="กำไรสุทธิ" value={`฿${fmt(grossProfit)}`} sub={`Conservative ฿${fmt(conservativeProfit)}`} />
        </div>

        <div style={styles.kpiGrid}>
          <KpiCard title="วันนี้" value={`฿${fmt(todayKsher + todayCoin)}`} sub={`กำไรวันนี้ ฿${fmt(todayProfit)}`} />
          <KpiCard title="เดือนนี้" value={`฿${fmt(monthKsher + monthCoin)}`} sub={`ค่าใช้จ่ายเดือนนี้ ฿${fmt(monthExp)}`} />
          <KpiCard title="จำนวนรายการ Ksher" value={String(totalTransactions)} sub={`เฉลี่ย/รายการ ฿${fmt(avgKsherPerTx)}`} />
          <KpiCard title="Top Machine" value={topMachine ? topMachine.name : '-'} sub={topMachine ? `Profit ฿${fmt(topMachine.profit)}` : '-'} />
        </div>

        <div style={styles.chartGrid}>
          <Panel title={`แนวโน้มรายวัน ${range === '7d' ? '7' : '14'} วันล่าสุด`} rightText="Ksher / Credit / Coin / Expense / Profit">
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                <LineChart data={chartDays}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="ksher" stroke="#f59e0b" strokeWidth={3} dot={false} name="Ksher" />
                  <Line type="monotone" dataKey="credit" stroke="#60a5fa" strokeWidth={2} dot={false} name="Credit" />
                  <Line type="monotone" dataKey="coin" stroke="#38bdf8" strokeWidth={3} dot={false} name="Coin" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} name="Expense" />
                  <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={3} dot={false} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="สรุปรายเดือน" rightText="แนวโน้มสะสม">
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={monthChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="ksher" fill="#f59e0b" name="Ksher" />
                  <Bar dataKey="coin" fill="#38bdf8" name="Coin" />
                  <Bar dataKey="expense" fill="#ef4444" name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <div style={styles.bottomGrid}>
          <Section title="Ksher ล่าสุด">
            {filteredKsher.length === 0 ? (
              <EmptyText text="ยังไม่มีข้อมูล Ksher" />
            ) : (
              filteredKsher.slice(0, 10).map((row) => (
                <Row
                  key={row.id}
                  left={`${row.invoice_no || '-'} | ${row.date || '-'}${row.merchant_no ? ` | M-${row.merchant_no}` : ''}`}
                  right={`฿${fmt(Number(row.trans_amount || 0))}`}
                  sub={`Credit ฿${fmt(Number(row.credit_amount || 0))} | Comm ฿${fmt(Number(row.commission || 0))}`}
                />
              ))
            )}
          </Section>

          <Section title="รายรับเหรียญ">
            {filteredCoin.length === 0 ? (
              <EmptyText text="ยังไม่มีข้อมูลเหรียญ" />
            ) : (
              filteredCoin.slice(0, 10).map((row) => (
                <Row
                  key={row.id}
                  left={`${row.week_start || '-'} | machine ${row.machine_id}`}
                  right={`฿${fmt(Number(row.amount || 0))}`}
                  sub={row.note || ''}
                />
              ))
            )}
          </Section>

          <Section title="รายจ่าย">
            {filteredExp.length === 0 ? (
              <EmptyText text="ยังไม่มีรายจ่าย" />
            ) : (
              filteredExp.slice(0, 10).map((row) => (
                <Row
                  key={row.id}
                  left={`${row.category || '-'} | ${row.date || '-'}`}
                  right={`฿${fmt(Number(row.amount || 0))}`}
                  sub={row.note || ''}
                />
              ))
            )}
          </Section>
        </div>

        <div style={styles.summaryGrid}>
          <Panel title="Executive Summary">
            <div style={styles.summaryText}>
              <div>ช่วงเวลาที่เลือก: <b>{rangeLabel(range)}</b></div>
              <div>รายรับรวม: <b>฿{fmt(totalRevenue)}</b></div>
              <div>รายรับ Ksher: <b>฿{fmt(totalKsher)}</b></div>
              <div>ยอดเครดิตเข้า: <b>฿{fmt(totalCredit)}</b></div>
              <div>รายรับเหรียญ: <b>฿{fmt(totalCoin)}</b></div>
              <div>รายจ่ายรวม: <b>฿{fmt(totalExp)}</b></div>
              <div>กำไรสุทธิ: <b>฿{fmt(grossProfit)}</b></div>
              <div>กำไร conservative: <b>฿{fmt(conservativeProfit)}</b></div>
            </div>
          </Panel>

          <Panel title="Quick Insight">
            <div style={styles.summaryText}>
              <div>วันนี้มียอดรวม: <b>฿{fmt(todayKsher + todayCoin)}</b></div>
              <div>เดือนนี้มียอดรวม: <b>฿{fmt(monthKsher + monthCoin)}</b></div>
              <div>ค่าใช้จ่ายเดือนนี้: <b>฿{fmt(monthExp)}</b></div>
              <div>จำนวนรายการ Ksher: <b>{totalTransactions}</b></div>
              <div>Top Machine: <b>{topMachine ? topMachine.name : '-'}</b></div>
            </div>
          </Panel>
        </div>

        <div style={styles.tableGrid}>
          <Panel title="Top Machine Ranking" rightText="จัดอันดับจากกำไร">
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Machine</th>
                    <th style={styles.th}>Location</th>
                    <th style={styles.th}>Ksher</th>
                    <th style={styles.th}>Credit</th>
                    <th style={styles.th}>Coin</th>
                    <th style={styles.th}>Expense</th>
                    <th style={styles.th}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {machineRanking.map((row, idx) => (
                    <tr key={row.id}>
                      <td style={styles.td}>{idx + 1}</td>
                      <td style={styles.td}>{row.name}</td>
                      <td style={styles.td}>{row.location}</td>
                      <td style={styles.td}>฿{fmt(row.ksher)}</td>
                      <td style={styles.td}>฿{fmt(row.credit)}</td>
                      <td style={styles.td}>฿{fmt(row.coin)}</td>
                      <td style={styles.td}>฿{fmt(row.exp)}</td>
                      <td style={styles.td}><b>฿{fmt(row.profit)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Recent Transactions" rightText="ล่าสุด 20 รายการ">
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Machine</th>
					<th style={styles.th}>Location</th>
                    <th style={styles.th}>Reference</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((row) => (
                    <tr key={row.key}>
                      <td style={styles.td}>{row.type}</td>
                      <td style={styles.td}>{row.date}</td>
                      <td style={styles.td}>{row.machine_id}</td>
					  <td style={styles.td}>{row.location}</td>
                      <td style={styles.td}>{row.ref}</td>
                      <td style={styles.td}>{row.amount < 0 ? `-฿${fmt(Math.abs(row.amount))}` : `฿${fmt(row.amount)}`}</td>
                      <td style={styles.td}>{row.sub}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>

      {showCoinForm && (
        <Modal title="บันทึกรายรับเหรียญ" onClose={() => setShowCoinForm(false)}>
          <MachineSelect machines={db.machines} value={coinForm.machine_id} onChange={(v) => setCoinForm({ ...coinForm, machine_id: v })} />
          <Input label="วันที่เริ่มสัปดาห์" type="date" value={coinForm.week_start} onChange={(v) => setCoinForm({ ...coinForm, week_start: v })} />
          <Input label="จำนวนเงิน" type="number" value={coinForm.amount} onChange={(v) => setCoinForm({ ...coinForm, amount: v })} />
          <Input label="หมายเหตุ" value={coinForm.note} onChange={(v) => setCoinForm({ ...coinForm, note: v })} />
          <button onClick={addCoin} style={btnBlue}>บันทึก</button>
        </Modal>
      )}

      {showKsherForm && (
        <Modal title="บันทึกรายรับ Ksher (Manual)" onClose={() => setShowKsherForm(false)}>
          <MachineSelect machines={db.machines} value={ksherForm.machine_id} onChange={(v) => setKsherForm({ ...ksherForm, machine_id: v })} />
          <Input label="วันที่" type="date" value={ksherForm.date} onChange={(v) => setKsherForm({ ...ksherForm, date: v })} />
          <Input label="ยอดเงิน" type="number" value={ksherForm.trans_amount} onChange={(v) => setKsherForm({ ...ksherForm, trans_amount: v })} />
          <Input label="Invoice No." value={ksherForm.invoice_no} onChange={(v) => setKsherForm({ ...ksherForm, invoice_no: v })} />
          <Input label="Merchant No." value={ksherForm.merchant_no} onChange={(v) => setKsherForm({ ...ksherForm, merchant_no: v })} />
          <Input label="หมายเหตุ" value={ksherForm.note} onChange={(v) => setKsherForm({ ...ksherForm, note: v })} />
          <button onClick={addKsherManual} style={btnAmber}>บันทึก</button>
        </Modal>
      )}

      {showExpenseForm && (
        <Modal title="บันทึกรายจ่าย" onClose={() => setShowExpenseForm(false)}>
          <MachineSelect machines={db.machines} value={expenseForm.machine_id} onChange={(v) => setExpenseForm({ ...expenseForm, machine_id: v })} />
          <Input label="หมวดรายจ่าย" value={expenseForm.category} onChange={(v) => setExpenseForm({ ...expenseForm, category: v })} />
          <Input label="วันที่" type="date" value={expenseForm.date} onChange={(v) => setExpenseForm({ ...expenseForm, date: v })} />
          <Input label="จำนวนเงิน" type="number" value={expenseForm.amount} onChange={(v) => setExpenseForm({ ...expenseForm, amount: v })} />
          <Input label="หมายเหตุ" value={expenseForm.note} onChange={(v) => setExpenseForm({ ...expenseForm, note: v })} />
          <button onClick={addExpense} style={btnRed}>บันทึก</button>
        </Modal>
      )}
    </main>
  );
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function buildLastNDays(n: number) {
  const arr: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    arr.push(x.toISOString().split('T')[0]);
  }
  return arr;
}

function getRangeStart(range: RangeKey) {
  const d = new Date();
  if (range === '7d') d.setDate(d.getDate() - 6);
  if (range === '30d') d.setDate(d.getDate() - 29);
  return d.toISOString().split('T')[0];
}

function inRange(dateStr: string, range: RangeKey, rangeStart: string, monthPrefix: string) {
  if (!dateStr) return false;
  if (range === 'all') return true;
  if (range === 'month') return dateStr.startsWith(monthPrefix);
  return dateStr >= rangeStart;
}

function shortDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
}

function rangeLabel(range: RangeKey) {
  if (range === '7d') return '7 วันล่าสุด';
  if (range === '30d') return '30 วันล่าสุด';
  if (range === 'month') return 'เดือนนี้';
  return 'ทั้งหมด';
}

function safeCsv(value: string) {
  return String(value || '');
}

function csvCell(value: string) {
  const v = String(value ?? '');
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function fmtNum(n: number) {
  return Number(n || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function KpiCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiSub}>{sub || '-'}</div>
    </div>
  );
}

function Panel({
  title,
  children,
  rightText,
}: {
  title: string;
  children: React.ReactNode;
  rightText?: string;
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <div style={styles.panelTitle}>{title}</div>
        <div style={styles.panelRight}>{rightText || ''}</div>
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Row({ left, right, sub }: { left: string; right: string; sub?: string }) {
  return (
    <div style={styles.row}>
      <div>
        <div style={styles.rowLeft}>{left}</div>
        {sub ? <div style={styles.rowSub}>{sub}</div> : null}
      </div>
      <div style={styles.rowRight}>{right}</div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div style={{ color: '#94a3b8', fontSize: 13 }}>{text}</div>;
}

function Box({ children, bg = '#111827' }: { children: React.ReactNode; bg?: string }) {
  return <div style={{ background: bg, padding: 16, borderRadius: 12, marginBottom: 16 }}>{children}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modalBox}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{title}</div>
          <button onClick={onClose} style={btnDark}>ปิด</button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function MachineSelect({
  machines,
  value,
  onChange
}: {
  machines: Machine[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={styles.label}>เลือกตู้</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={inputStyle}
      >
        {machines.map(m => (
          <option key={m.id} value={m.id}>
            {m.name} {m.location ? `- ${m.location}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text'
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={styles.label}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  color: '#fff',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #334155',
  background: '#111827',
  color: '#fff',
  outline: 'none'
};

const pillBtn: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid #334155',
  cursor: 'pointer',
  fontWeight: 700
};

const btnDark: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700
};

const btnSlate: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700
};

const btnBlue: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#0ea5e9',
  color: '#000',
  cursor: 'pointer',
  fontWeight: 800
};

const btnAmber: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#f59e0b',
  color: '#000',
  cursor: 'pointer',
  fontWeight: 800
};

const btnRed: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#ef4444',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 800
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    fontFamily: 'Arial, sans-serif',
    background: 'linear-gradient(180deg, #020817 0%, #07122a 100%)',
    minHeight: '100vh',
    color: '#e5e7eb',
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  headerWrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 18,
  },
  actionWrap: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  toolbarRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
    marginBottom: 14,
  },
  kpiCard: {
    background: 'linear-gradient(180deg, #0b1328 0%, #0f172a 100%)',
    border: '1px solid #1f2937',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
  },
  kpiTitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: 700,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: 900,
    marginBottom: 8,
  },
  kpiSub: {
    color: '#7dd3fc',
    fontSize: 13,
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1fr',
    gap: 16,
    marginTop: 18,
    marginBottom: 18,
  },
  panel: {
    background: 'linear-gradient(180deg, #0b1328 0%, #0f172a 100%)',
    border: '1px solid #1f2937',
    borderRadius: 18,
    padding: 18,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
  },
  panelRight: {
    color: '#94a3b8',
    fontSize: 12,
  },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr',
    gap: 16,
    marginBottom: 18,
  },
  section: {
    background: 'linear-gradient(180deg, #0b1328 0%, #0f172a 100%)',
    border: '1px solid #1f2937',
    borderRadius: 18,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 14,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 12,
    borderBottom: '1px solid #1f2937',
    alignItems: 'flex-start',
  },
  rowLeft: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 1.5,
  },
  rowSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  rowRight: {
    fontWeight: 800,
    fontSize: 15,
    whiteSpace: 'nowrap',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginTop: 6,
    marginBottom: 16,
  },
  summaryText: {
    color: '#cbd5e1',
    lineHeight: 2,
    fontSize: 15,
  },
  tableGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginTop: 8,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid #334155',
    color: '#93c5fd',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #1f2937',
    color: '#e5e7eb',
    verticalAlign: 'top',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalBox: {
    width: '100%',
    maxWidth: 500,
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
  },
  label: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: 700,
  },
};