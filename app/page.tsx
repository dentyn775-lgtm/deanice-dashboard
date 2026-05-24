'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
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
  settlement_date?: string | null;
  txn_date?: string | null;
  date?: string | null;
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

type ExpenseMaster = {
  id: number;
  machine_id: number | null;
  expense_type: string | null;
  expense_category: string | null;
  amount: number;
  expense_date: string;
  recurring: boolean | null;
  recurring_type: string | null;
  note: string | null;
  created_at?: string | null;
};

type TxnRow = {
  key: string;
  type: string;
  date: string;
  machine_id: number | null;
  location: string;
  ref: string;
  amount: number;
  sub: string;
};

export default function Page() {
  const [db, setDb] = useState<{
    machines: Machine[];
    income_coin: IncomeCoin[];
    income_ksher: IncomeKsher[];
    expenses: Expense[];
    expense_master: ExpenseMaster[];
  }>({
    machines: [],
    income_coin: [],
    income_ksher: [],
    expenses: [],
    expense_master: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selMachine, setSelMachine] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0, 7));

  const [showCoinForm, setShowCoinForm] = useState(false);
  const [showKsherForm, setShowKsherForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [chartWidth, setChartWidth] = useState(620);

  const [coinForm, setCoinForm] = useState({
    machine_id: 1,
    week_start: today(),
    amount: '',
    note: '',
  });

  const [ksherForm, setKsherForm] = useState({
    machine_id: 1,
    txn_date: today(),
    settlement_date: today(),
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
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      const w = window.innerWidth || 1024;
      const mobile = w <= 768;
      setIsMobile(mobile);
      setChartWidth(mobile ? Math.max(360, w - 64) : 620);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
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
        { data: expense_master, error: e5 },
      ] = await Promise.all([
        supabase.from('machines').select('*').order('id'),
        supabase.from('income_coin').select('*').order('week_start', { ascending: false }),
        supabase.from('income_ksher').select('*').order('txn_date', { ascending: false }),
        supabase.from('expenses').select('*').order('date', { ascending: false }),
        supabase.from('expense_master').select('*').order('expense_date', { ascending: false }),
      ]);

      if (e1 || e2 || e3 || e4 || e5) {
        throw new Error(e1?.message || e2?.message || e3?.message || e4?.message || e5?.message || 'Load data failed');
      }

      const nextDb = {
        machines: (machines || []) as Machine[],
        income_coin: (income_coin || []) as IncomeCoin[],
        income_ksher: (income_ksher || []) as IncomeKsher[],
        expenses: (expenses || []) as Expense[],
        expense_master: (expense_master || []) as ExpenseMaster[],
      };

      setDb(nextDb);

      const options = buildMonthOptions(nextDb.income_ksher, nextDb.income_coin, nextDb.expenses, nextDb.expense_master);
      if (options.length && !options.includes(selectedMonth)) {
        setSelectedMonth(options[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function addCoin() {
    const machineId = Number(coinForm.machine_id);
    const amount = Number(coinForm.amount);
    const note = coinForm.note?.trim() || null;

    if (!machineId || !coinForm.week_start || !amount || amount <= 0) {
      alert('กรุณาระบุ ตู้ / วันที่ / จำนวนเงิน ให้ถูกต้อง');
      return;
    }

    // กันข้อมูลซ้ำก่อน insert: machine_id + week_start + amount + note
    let duplicateQuery = supabase
      .from('income_coin')
      .select('id')
      .eq('machine_id', machineId)
      .eq('week_start', coinForm.week_start)
      .eq('amount', amount)
      .limit(1);

    duplicateQuery = note === null ? duplicateQuery.is('note', null) : duplicateQuery.eq('note', note);

    const { data: existing, error: checkError } = await duplicateQuery;

    if (checkError) {
      alert('ตรวจสอบข้อมูลซ้ำไม่สำเร็จ: ' + checkError.message);
      return;
    }

    if (existing && existing.length > 0) {
      alert('พบรายการรายรับเหรียญซ้ำ ระบบไม่บันทึกซ้ำให้ครับ');
      setShowCoinForm(false);
      setCoinForm(prev => ({ ...prev, amount: '', note: '' }));
      await loadData();
      return;
    }

    const { error } = await supabase.from('income_coin').insert({
      machine_id: machineId,
      week_start: coinForm.week_start,
      amount,
      note,
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
      txn_date: ksherForm.txn_date,
      settlement_date: ksherForm.settlement_date || ksherForm.txn_date,
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

  const monthOptions = useMemo(
    () => buildMonthOptions(db.income_ksher, db.income_coin, db.expenses, db.expense_master),
    [db]
  );

  const currentYear = selectedMonth.slice(0, 4);
  const prevMonth = addMonths(selectedMonth, -1);
  const selectedMonthLabel = formatMonthLabel(selectedMonth);

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

  const filteredKsher = useMemo(() => {
    return machineFilteredKsher.filter(row => getKsherTxnDate(row).slice(0, 7) === selectedMonth);
  }, [machineFilteredKsher, selectedMonth]);

  const filteredCoin = useMemo(() => {
    return machineFilteredCoin.filter(row => (row.week_start || '').slice(0, 7) === selectedMonth);
  }, [machineFilteredCoin, selectedMonth]);

  const filteredExp = useMemo(() => {
    return machineFilteredExp.filter(row => (row.date || '').slice(0, 7) === selectedMonth);
  }, [machineFilteredExp, selectedMonth]);

  const filteredMasterExp = useMemo(() => {
    return expenseMasterForMonth(db.expense_master, selectedMonth, selMachine);
  }, [db.expense_master, selectedMonth, selMachine]);

  const totalKsher = filteredKsher.reduce((s, x) => s + Number(x.trans_amount || 0), 0);
  const totalCredit = filteredKsher.reduce((s, x) => s + Number(x.credit_amount || 0), 0);
  const totalCoin = filteredCoin.reduce((s, x) => s + Number(x.amount || 0), 0);
  const actualExpense = filteredExp.reduce((s, x) => s + Number(x.amount || 0), 0);
  const masterExpense = filteredMasterExp.reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalExp = actualExpense + masterExpense;

  const totalRevenue = totalKsher + totalCoin;
  const grossProfit = totalRevenue - totalExp;
  const conservativeProfit = totalCredit + totalCoin - totalExp;

  const todayStr = today();
  const isCurrentMonth = selectedMonth === todayStr.slice(0, 7);

  const todayKsher = machineFilteredKsher
    .filter(x => getKsherTxnDate(x) === todayStr)
    .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

  const todayCoin = machineFilteredCoin
    .filter(x => x.week_start === todayStr)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const todayExp = machineFilteredExp
    .filter(x => x.date === todayStr)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const todayProfit = todayKsher + todayCoin - todayExp;

  const prevKsher = machineFilteredKsher
    .filter(x => getKsherTxnDate(x).slice(0, 7) === prevMonth)
    .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

  const prevCoin = machineFilteredCoin
    .filter(x => (x.week_start || '').slice(0, 7) === prevMonth)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const prevActualExp = machineFilteredExp
    .filter(x => (x.date || '').slice(0, 7) === prevMonth)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const prevMasterExp = expenseMasterForMonth(db.expense_master, prevMonth, selMachine)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const prevRevenue = prevKsher + prevCoin;
  const prevExpense = prevActualExp + prevMasterExp;
  const prevProfit = prevRevenue - prevExpense;

  const momRevenueGrowth = calcGrowth(totalRevenue, prevRevenue);
  const momProfitGrowth = calcGrowth(grossProfit, prevProfit);

  const ytdKsher = machineFilteredKsher
    .filter(x => getKsherTxnDate(x).startsWith(currentYear) && getKsherTxnDate(x).slice(0, 7) <= selectedMonth)
    .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

  const ytdCredit = machineFilteredKsher
    .filter(x => getKsherTxnDate(x).startsWith(currentYear) && getKsherTxnDate(x).slice(0, 7) <= selectedMonth)
    .reduce((s, x) => s + Number(x.credit_amount || 0), 0);

  const ytdCoin = machineFilteredCoin
    .filter(x => (x.week_start || '').startsWith(currentYear) && (x.week_start || '').slice(0, 7) <= selectedMonth)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const ytdActualExp = machineFilteredExp
    .filter(x => (x.date || '').startsWith(currentYear) && (x.date || '').slice(0, 7) <= selectedMonth)
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const ytdMasterExp = buildMonthsYtd(currentYear, selectedMonth)
    .reduce((sum, month) => {
      return sum + expenseMasterForMonth(db.expense_master, month, selMachine)
        .reduce((s, x) => s + Number(x.amount || 0), 0);
    }, 0);

  const ytdRevenue = ytdKsher + ytdCoin;
  const ytdExpense = ytdActualExp + ytdMasterExp;
  const ytdProfit = ytdRevenue - ytdExpense;
  const ytdConservativeProfit = ytdCredit + ytdCoin - ytdExpense;

  const breakEvenGap = grossProfit;
  const breakEvenText = breakEvenGap >= 0
    ? `เกินจุดคุ้มทุน ฿${fmt(breakEvenGap)}`
    : `ขาดทุนเดือนนี้ ฿${fmt(Math.abs(breakEvenGap))}`;

  const totalTransactions = filteredKsher.length;
  const avgKsherPerTx = totalTransactions > 0 ? totalKsher / totalTransactions : 0;

  const chartDays = useMemo(() => {
    const days = buildDaysInMonth(selectedMonth);
    const dailyMaster = 0;

    return days.map(day => {
      const ksher = machineFilteredKsher
        .filter(x => getKsherTxnDate(x) === day)
        .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

      const credit = machineFilteredKsher
        .filter(x => getKsherTxnDate(x) === day)
        .reduce((s, x) => s + Number(x.credit_amount || 0), 0);

      const expense = machineFilteredExp
        .filter(x => x.date === day)
        .reduce((s, x) => s + Number(x.amount || 0), 0) + dailyMaster;

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
  }, [machineFilteredKsher, machineFilteredCoin, machineFilteredExp, selectedMonth]);

  const monthChart = useMemo(() => {
    const months = buildMonthsYtd(currentYear, selectedMonth);

    return months.map(month => {
      const ksher = machineFilteredKsher
        .filter(x => getKsherTxnDate(x).slice(0, 7) === month)
        .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

      const credit = machineFilteredKsher
        .filter(x => getKsherTxnDate(x).slice(0, 7) === month)
        .reduce((s, x) => s + Number(x.credit_amount || 0), 0);

      const coin = machineFilteredCoin
        .filter(x => (x.week_start || '').slice(0, 7) === month)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      const actualExp = machineFilteredExp
        .filter(x => (x.date || '').slice(0, 7) === month)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      const fixedExp = expenseMasterForMonth(db.expense_master, month, selMachine)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      const expense = actualExp + fixedExp;

      return {
        month,
        ksher,
        credit,
        coin,
        expense,
        profit: ksher + coin - expense,
      };
    });
  }, [currentYear, selectedMonth, machineFilteredKsher, machineFilteredCoin, machineFilteredExp, db.expense_master, selMachine]);

  const machineRanking = useMemo(() => {
    const rows = db.machines.map(m => {
      const ksher = db.income_ksher
        .filter(x => x.machine_id === m.id && getKsherTxnDate(x).slice(0, 7) === selectedMonth)
        .reduce((s, x) => s + Number(x.trans_amount || 0), 0);

      const credit = db.income_ksher
        .filter(x => x.machine_id === m.id && getKsherTxnDate(x).slice(0, 7) === selectedMonth)
        .reduce((s, x) => s + Number(x.credit_amount || 0), 0);

      const coin = db.income_coin
        .filter(x => x.machine_id === m.id && (x.week_start || '').slice(0, 7) === selectedMonth)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      const actualExp = db.expenses
        .filter(x => x.machine_id === m.id && (x.date || '').slice(0, 7) === selectedMonth)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      const fixedExp = expenseMasterForMonth(db.expense_master, selectedMonth, m.id)
        .reduce((s, x) => s + Number(x.amount || 0), 0);

      const exp = actualExp + fixedExp;

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
  }, [db, selectedMonth]);

  const topMachine = machineRanking[0] || null;

  const recentTransactions = useMemo<TxnRow[]>(() => {
    const machineMap = new Map(db.machines.map(m => [m.id, m.location || '-']));

    const ksherRows: TxnRow[] = filteredKsher.map(row => ({
      key: `k-${row.id}`,
      type: 'Ksher',
      date: getKsherTxnDate(row),
      machine_id: row.machine_id,
      location: machineMap.get(row.machine_id) || '-',
      ref: row.invoice_no || '-',
      amount: Number(row.trans_amount || 0),
      sub: `Txn ${row.txn_date || '-'} | Settle ${row.settlement_date || '-'} | Credit ฿${fmtNum(row.credit_amount || 0)} | M-${row.merchant_no || '-'}`,
    }));

    const coinRows: TxnRow[] = filteredCoin.map(row => ({
      key: `c-${row.id}`,
      type: 'Coin',
      date: row.week_start,
      machine_id: row.machine_id,
      location: machineMap.get(row.machine_id) || '-',
      ref: row.note || 'บันทึกรับเหรียญ',
      amount: Number(row.amount || 0),
      sub: 'รายรับเหรียญ',
    }));

    const expRows: TxnRow[] = filteredExp.map(row => ({
      key: `e-${row.id}`,
      type: 'Expense',
      date: row.date,
      machine_id: row.machine_id,
      location: machineMap.get(row.machine_id) || '-',
      ref: row.category || '-',
      amount: Number(row.amount || 0) * -1,
      sub: row.note || '',
    }));

    const masterRows: TxnRow[] = filteredMasterExp.map(row => ({
      key: `m-${row.id}-${selectedMonth}`,
      type: row.recurring ? 'Fixed Cost' : 'Master Cost',
      date: `${selectedMonth}-01`,
      machine_id: row.machine_id,
      location: row.machine_id ? machineMap.get(row.machine_id) || '-' : 'ทุกตู้',
      ref: row.expense_type || row.expense_category || 'ค่าใช้จ่ายประจำ',
      amount: Number(row.amount || 0) * -1,
      sub: `${row.expense_category || '-'} | ${row.recurring ? `Recurring ${row.recurring_type || ''}` : 'One-time'} | ${row.note || ''}`,
    }));

    return [...ksherRows, ...coinRows, ...expRows, ...masterRows]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 100);
  }, [filteredKsher, filteredCoin, filteredExp, filteredMasterExp, db.machines, selectedMonth]);

  function fmt(n: number) {
    return Number(n || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function exportCsv() {
    const rows = [
      ['type', 'txn_date', 'machine_id', 'location', 'reference', 'amount', 'sub'],
      ...recentTransactions.map(r => [
        r.type,
        formatCsvDate(r.date),
        String(r.machine_id ?? ''),
        safeCsv(r.location || '-'),
        safeCsv(r.ref),
        String(r.amount),
        safeCsv(r.sub),
      ]),
    ];

    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deanice-dashboard-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const headerStyle: React.CSSProperties = {
    ...styles.headerWrap,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  };

  const actionWrapStyle: React.CSSProperties = {
    ...styles.actionWrap,
    justifyContent: isMobile ? 'stretch' : 'flex-end',
    width: isMobile ? '100%' : undefined,
  };

  const actionButtonStyle = (base: React.CSSProperties): React.CSSProperties => ({
    ...base,
    flex: isMobile ? '1 1 calc(50% - 8px)' : undefined,
    padding: isMobile ? '14px 10px' : base.padding,
    fontSize: isMobile ? 15 : undefined,
  });

  const toolbarStyle: React.CSSProperties = {
    ...styles.toolbarRow,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : undefined,
  };

  const filterRowStyle : React.CSSProperties = {
    ...styles.filterRow,
    width: isMobile ? '100%' : undefined,
    overflowX: isMobile ? 'auto' : undefined,
    flexWrap: isMobile ? 'nowrap' : 'wrap',
    paddingBottom: isMobile ? 4 : undefined,
  };

  const pillButtonStyle = (activeBg: string, activeColor: string, active: boolean): React.CSSProperties => ({
    ...pillBtn,
    background: active ? activeBg : '#111827',
    color: active ? activeColor : '#fff',
    whiteSpace: 'nowrap',
    flex: isMobile ? '0 0 auto' : undefined,
    padding: isMobile ? '10px 14px' : pillBtn.padding,
    fontSize: isMobile ? 13 : undefined,
  });

  const responsiveKpiGrid: React.CSSProperties = {
    ...styles.kpiGrid,
    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : styles.kpiGrid.gridTemplateColumns,
    gap: isMobile ? 10 : styles.kpiGrid.gap,
  };

  const responsiveChartGrid: React.CSSProperties = {
    ...styles.chartGrid,
    gridTemplateColumns: isMobile ? '1fr' : styles.chartGrid.gridTemplateColumns,
  };

  const responsiveBottomGrid: React.CSSProperties = {
    ...styles.bottomGrid,
    gridTemplateColumns: isMobile ? '1fr' : styles.bottomGrid.gridTemplateColumns,
  };

  const responsiveSummaryGrid: React.CSSProperties = {
    ...styles.summaryGrid,
    gridTemplateColumns: isMobile ? '1fr' : styles.summaryGrid.gridTemplateColumns,
  };

  const responsiveTableGrid: React.CSSProperties = {
    ...styles.tableGrid,
    gridTemplateColumns: isMobile ? '1fr' : styles.tableGrid.gridTemplateColumns,
  };

  const chartHeight = isMobile ? 260 : 340;

  const mobileChartWrap: React.CSSProperties = {
    width: '100%',
    height: chartHeight,
    minWidth: 0,
    overflowX: isMobile ? 'auto' : 'hidden',
    overflowY: 'hidden',
  };

  const panelStyle: React.CSSProperties = {
    ...styles.panel,
    padding: isMobile ? 14 : styles.panel.padding,
  };

  const tableStyle: React.CSSProperties = {
    ...styles.table,
    minWidth: isMobile ? 820 : undefined,
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={headerStyle}>
          <div>
            <h1 style={{...styles.title, fontSize: isMobile ? 30 : styles.title.fontSize}}>DeanIce Dashboard Pro</h1>
            <div style={{...styles.subtitle, fontSize: isMobile ? 15 : styles.subtitle.fontSize}}>
              เชื่อม Supabase สำเร็จแล้ว · Monthly P&amp;L · MTD/YTD · ใช้งานจริง
            </div>
          </div>

          <div style={actionWrapStyle}>
            <button onClick={loadData} style={actionButtonStyle(btnDark)}>Reload</button>
            <button onClick={exportCsv} style={actionButtonStyle(btnSlate)}>Export CSV</button>
            <button onClick={() => setShowCoinForm(true)} style={actionButtonStyle(btnBlue)}>+ รายรับเหรียญ</button>
            <button onClick={() => setShowKsherForm(true)} style={actionButtonStyle(btnAmber)}>+ รายรับ Ksher</button>
            <button onClick={() => setShowExpenseForm(true)} style={actionButtonStyle(btnRed)}>+ รายจ่าย</button>
          </div>
        </div>

        {loading && <Box>Loading...</Box>}
        {error && <Box bg="#7f1d1d">Error: {error}</Box>}

        <div style={toolbarStyle}>
          <div style={filterRowStyle}>
            <button
              onClick={() => setSelMachine(null)}
              style={{...pillButtonStyle('#0ea5e9', '#000', selMachine === null)}}
            >
              ทุกตู้
            </button>

            {db.machines.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelMachine(m.id)}
                style={{...pillButtonStyle('#f59e0b', '#000', selMachine === m.id)}}
              >
                {m.name}
              </button>
            ))}
          </div>

          <div style={styles.monthPickerWrap}>
            <span style={styles.monthPickerLabel}>เลือกเดือน</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={styles.monthSelect}
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={responsiveKpiGrid}>
          <KpiCard title="จำนวนตู้" value={String(db.machines.length)} sub={topMachine ? `Top: ${topMachine.name}` : '-'} compact={isMobile} />
          <KpiCard title={`${selectedMonthLabel} Revenue`} value={`฿${fmt(totalRevenue)}`} sub={`Ksher ฿${fmt(totalKsher)} | Coin ฿${fmt(totalCoin)}`} compact={isMobile} />
          <KpiCard title={`${selectedMonthLabel} Expense`} value={`฿${fmt(totalExp)}`} sub={`Fixed ฿${fmt(masterExpense)} | Variable ฿${fmt(actualExpense)}`} compact={isMobile} />
          <KpiCard title={`${selectedMonthLabel} Profit`} value={`฿${fmt(grossProfit)}`} sub={`Conservative ฿${fmt(conservativeProfit)}`} compact={isMobile} />
        </div>

        <div style={responsiveKpiGrid}>
          <KpiCard title="MTD Revenue" value={`฿${fmt(totalRevenue)}`} sub={`MoM Revenue ${momRevenueGrowth.toFixed(1)}%`} compact={isMobile} />
          <KpiCard title="MTD Profit" value={`฿${fmt(grossProfit)}`} sub={`${breakEvenText}`} compact={isMobile} />
          <KpiCard title="YTD Revenue" value={`฿${fmt(ytdRevenue)}`} sub={`Expense ฿${fmt(ytdExpense)} | Profit ฿${fmt(ytdProfit)}`} compact={isMobile} />
          <KpiCard title="YTD Profit" value={`฿${fmt(ytdProfit)}`} sub={`MoM Profit ${momProfitGrowth.toFixed(1)}%`} compact={isMobile} />
        </div>

        <div style={responsiveKpiGrid}>
          <KpiCard title="YTD Ksher / Online" value={`฿${fmt(ytdKsher)}`} sub={`Credit ฿${fmt(ytdCredit)}`} compact={isMobile} />
          <KpiCard title="YTD Coin" value={`฿${fmt(ytdCoin)}`} sub="รายรับเหรียญสะสมทั้งปี" compact={isMobile} />
          <KpiCard title={isCurrentMonth ? 'วันนี้' : 'Today'} value={`฿${fmt(isCurrentMonth ? todayKsher + todayCoin : 0)}`} sub={`กำไรวันนี้ ฿${fmt(isCurrentMonth ? todayProfit : 0)}`} compact={isMobile} />
          <KpiCard title="YTD Conservative" value={`฿${fmt(ytdConservativeProfit)}`} sub="อิงยอดเครดิตเข้า" compact={isMobile} />
        </div>

        <div style={responsiveKpiGrid}>
          <KpiCard title="จำนวนรายการ Ksher" value={String(totalTransactions)} sub={`เฉลี่ย/รายการ ฿${fmt(avgKsherPerTx)}`} compact={isMobile} />
          <KpiCard title="Top Machine" value={topMachine ? topMachine.name : '-'} sub={topMachine ? `Profit ฿${fmt(topMachine.profit)}` : '-'} compact={isMobile} />
          <KpiCard title="YTD Expense" value={`฿${fmt(ytdExpense)}`} sub={`Fixed/Variable รวมถึง ${selectedMonthLabel}`} compact={isMobile} />
          <KpiCard title="Duplicate Guard" value="ON" sub="Coin: machine+date+amount+note" compact={isMobile} />
        </div>

        <div style={responsiveChartGrid}>
          <Panel title={`แนวโน้มรายวัน ${selectedMonthLabel}`} rightText="Ksher / Credit / Coin / Expense / Profit" compact={isMobile}>
            <div style={mobileChartWrap}>
              <LineChart width={chartWidth} height={chartHeight} data={chartDays} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#94a3b8" interval={isMobile ? 4 : 2} />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="coin" stroke="#38bdf8" strokeWidth={2} dot={false} name="Coin" />
                <Line type="monotone" dataKey="credit" stroke="#60a5fa" strokeWidth={2} dot={false} name="Credit" />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} name="Expense" />
                <Line type="monotone" dataKey="ksher" stroke="#f59e0b" strokeWidth={2} dot={false} name="Ksher" />
                <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={3} dot={false} name="Profit" />
              </LineChart>
            </div>
          </Panel>

          <Panel title={`YTD Monthly P&L ${currentYear}`} rightText="รวม Fixed cost จาก expense_master" compact={isMobile}>
            <div style={mobileChartWrap}>
              <BarChart width={chartWidth} height={chartHeight} data={monthChart} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="coin" fill="#38bdf8" name="Coin" />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" />
                <Bar dataKey="ksher" fill="#f59e0b" name="Ksher" />
              </BarChart>
            </div>
          </Panel>
        </div>

        <div style={responsiveBottomGrid}>
          <Section title="Ksher ล่าสุด" compact={isMobile}>
            {filteredKsher.length === 0 ? (
              <EmptyText text="ยังไม่มีข้อมูล Ksher ในเดือนนี้" />
            ) : (
              filteredKsher.slice(0, 10).map((row) => (
                <Row
                  compact={isMobile}
                  key={row.id}
                  left={`${row.invoice_no || '-'} | Txn ${row.txn_date || '-'} | Settle ${row.settlement_date || '-'}${row.merchant_no ? ` | M-${row.merchant_no}` : ''}`}
                  right={`฿${fmt(Number(row.trans_amount || 0))}`}
                  sub={`Credit ฿${fmt(Number(row.credit_amount || 0))} | Comm ฿${fmt(Number(row.commission || 0))}`}
                />
              ))
            )}
          </Section>

          <Section title="รายรับเหรียญ" compact={isMobile}>
            {filteredCoin.length === 0 ? (
              <EmptyText text="ยังไม่มีข้อมูลเหรียญในเดือนนี้" />
            ) : (
              filteredCoin.slice(0, 10).map((row) => (
                <Row
                  compact={isMobile}
                  key={row.id}
                  left={`${row.week_start || '-'} | machine ${row.machine_id}`}
                  right={`฿${fmt(Number(row.amount || 0))}`}
                  sub={row.note || ''}
                />
              ))
            )}
          </Section>

          <Section title="รายจ่าย / Fixed Cost" compact={isMobile}>
            {filteredExp.length === 0 && filteredMasterExp.length === 0 ? (
              <EmptyText text="ยังไม่มีรายจ่ายในเดือนนี้" />
            ) : (
              <>
                {filteredMasterExp.slice(0, 5).map((row) => (
                  <Row
                    compact={isMobile}
                    key={`master-${row.id}`}
                    left={`${row.expense_type || row.expense_category || 'Fixed Cost'} | ${selectedMonth}-01`}
                    right={`฿${fmt(Number(row.amount || 0))}`}
                    sub={`${row.expense_category || '-'} | ${row.recurring ? `Recurring ${row.recurring_type || ''}` : 'One-time'} | ${row.note || ''}`}
                  />
                ))}
                {filteredExp.slice(0, 10).map((row) => (
                  <Row
                    compact={isMobile}
                    key={row.id}
                    left={`${row.category || '-'} | ${row.date || '-'}`}
                    right={`฿${fmt(Number(row.amount || 0))}`}
                    sub={row.note || ''}
                  />
                ))}
              </>
            )}
          </Section>
        </div>

        <div style={responsiveSummaryGrid}>
          <Panel title="Executive Monthly Insight" compact={isMobile}>
            <div style={styles.summaryText}>
              <div>เดือนที่เลือก: <b>{selectedMonthLabel}</b></div>
              <div>รายรับรวม: <b>฿{fmt(totalRevenue)}</b></div>
              <div>ค่าใช้จ่ายรวม: <b>฿{fmt(totalExp)}</b></div>
              <div>Fixed Cost: <b>฿{fmt(masterExpense)}</b></div>
              <div>Variable Cost: <b>฿{fmt(actualExpense)}</b></div>
              <div>กำไรสุทธิ: <b>฿{fmt(grossProfit)}</b></div>
              <div>MoM Revenue Growth: <b>{momRevenueGrowth.toFixed(1)}%</b></div>
              <div>MoM Profit Growth: <b>{momProfitGrowth.toFixed(1)}%</b></div>
              <div>Break-even: <b>{breakEvenText}</b></div>
            </div>
          </Panel>

          <Panel title="YTD Summary" compact={isMobile}>
            <div style={styles.summaryText}>
              <div>ปี: <b>{currentYear}</b></div>
              <div>YTD Ksher / Online: <b>฿{fmt(ytdKsher)}</b></div>
              <div>YTD Credit Received: <b>฿{fmt(ytdCredit)}</b></div>
              <div>YTD Coin: <b>฿{fmt(ytdCoin)}</b></div>
              <div>YTD Revenue: <b>฿{fmt(ytdRevenue)}</b></div>
              <div>YTD Expense: <b>฿{fmt(ytdExpense)}</b></div>
              <div>YTD Profit: <b>฿{fmt(ytdProfit)}</b></div>
              <div>YTD Conservative Profit: <b>฿{fmt(ytdConservativeProfit)}</b></div>
              <div>Top Machine: <b>{topMachine ? topMachine.name : '-'}</b></div>
            </div>
          </Panel>
        </div>

        <div style={responsiveTableGrid}>
          <Panel title="Top Machine Ranking" rightText={selectedMonthLabel} compact={isMobile}>
            <div style={styles.tableWrap}>
              <table style={tableStyle}>
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

          <Panel title="Monthly Transactions" rightText={`${recentTransactions.length} รายการ`} compact={isMobile}>
            <div style={styles.tableWrap}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Txn Date</th>
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
                      <td style={styles.td}>{row.machine_id ?? '-'}</td>
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
          <Input label="วันที่รับเหรียญ" type="date" value={coinForm.week_start} onChange={(v) => setCoinForm({ ...coinForm, week_start: v })} />
          <Input label="จำนวนเงิน" type="number" value={coinForm.amount} onChange={(v) => setCoinForm({ ...coinForm, amount: v })} />
          <Input label="หมายเหตุ" value={coinForm.note} onChange={(v) => setCoinForm({ ...coinForm, note: v })} />
          <button onClick={addCoin} style={btnBlue}>บันทึก</button>
        </Modal>
      )}

      {showKsherForm && (
        <Modal title="บันทึกรายรับ Ksher (Manual)" onClose={() => setShowKsherForm(false)}>
          <MachineSelect machines={db.machines} value={ksherForm.machine_id} onChange={(v) => setKsherForm({ ...ksherForm, machine_id: v })} />
          <Input label="Txn Date" type="date" value={ksherForm.txn_date} onChange={(v) => setKsherForm({ ...ksherForm, txn_date: v })} />
          <Input label="Settlement Date" type="date" value={ksherForm.settlement_date} onChange={(v) => setKsherForm({ ...ksherForm, settlement_date: v })} />
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

function getKsherTxnDate(row: IncomeKsher) {
  return row.txn_date || row.date || row.settlement_date || '';
}

function buildDaysInMonth(month: string) {
  const [year, monthNo] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNo, 0).getDate();
  const arr: string[] = [];
  for (let i = 1; i <= lastDay; i++) {
    arr.push(`${month}-${String(i).padStart(2, '0')}`);
  }
  return arr;
}

function buildMonthsYtd(year: string, selectedMonth: string) {
  const arr: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const m = `${year}-${String(i).padStart(2, '0')}`;
    if (m <= selectedMonth) arr.push(m);
  }
  return arr;
}

function buildMonthOptions(
  ksher: IncomeKsher[],
  coin: IncomeCoin[],
  expenses: Expense[],
  masters: ExpenseMaster[]
) {
  const set = new Set<string>();
  set.add(today().slice(0, 7));

  ksher.forEach(x => {
    const d = getKsherTxnDate(x);
    if (d) set.add(d.slice(0, 7));
  });
  coin.forEach(x => {
    if (x.week_start) set.add(x.week_start.slice(0, 7));
  });
  expenses.forEach(x => {
    if (x.date) set.add(x.date.slice(0, 7));
  });
  masters.forEach(x => {
    if (x.expense_date) set.add(x.expense_date.slice(0, 7));
  });

  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

function expenseMasterForMonth(rows: ExpenseMaster[], month: string, machineId: number | null) {
  return rows
    .filter(r => !machineId || r.machine_id === machineId || r.machine_id === null)
    .filter(r => {
      const rowMonth = (r.expense_date || '').slice(0, 7);
      if (r.recurring && String(r.recurring_type || '').toUpperCase() === 'MONTHLY') {
        return rowMonth <= month;
      }
      return rowMonth === month;
    });
}

function addMonths(month: string, offset: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function calcGrowth(current: number, previous: number) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function shortDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
}

function formatCsvDate(date: string) {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return date;
  return `${d}/${m}/${String(Number(y) + 543).slice(-2)}`;
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

function KpiCard({ title, value, sub, compact }: { title: string; value: string; sub?: string; compact?: boolean }) {
  return (
    <div style={{...styles.kpiCard, padding: compact ? 14 : styles.kpiCard.padding}}>
      <div style={{...styles.kpiTitle, fontSize: compact ? 12 : styles.kpiTitle.fontSize}}>{title}</div>
      <div style={{...styles.kpiValue, fontSize: compact ? 24 : styles.kpiValue.fontSize}}>{value}</div>
      <div style={{...styles.kpiSub, fontSize: compact ? 12 : styles.kpiSub.fontSize}}>{sub || '-'}</div>
    </div>
  );
}

function Panel({
  title,
  children,
  rightText,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  rightText?: string;
  compact?: boolean;
}) {
  return (
    <div style={{...styles.panel, padding: compact ? 14 : styles.panel.padding}}>
      <div style={{...styles.panelHeader, alignItems: compact ? 'flex-start' : 'center'}}>
        <div style={{...styles.panelTitle, fontSize: compact ? 17 : styles.panelTitle.fontSize}}>{title}</div>
        <div style={styles.panelRight}>{rightText || ''}</div>
      </div>
      {children}
    </div>
  );
}

function Section({ title, children, compact }: { title: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{...styles.section, padding: compact ? 14 : styles.section.padding}}>
      <div style={{...styles.sectionTitle, fontSize: compact ? 17 : styles.sectionTitle.fontSize}}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Row({ left, right, sub, compact }: { left: string; right: string; sub?: string; compact?: boolean }) {
  return (
    <div style={{...styles.row, flexDirection: compact ? 'column' : 'row'}}>
      <div>
        <div style={{...styles.rowLeft, fontSize: compact ? 13 : styles.rowLeft.fontSize}}>{left}</div>
        {sub ? <div style={styles.rowSub}>{sub}</div> : null}
      </div>
      <div style={{...styles.rowRight, alignSelf: compact ? 'flex-end' : undefined}}>{right}</div>
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
  monthPickerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  monthPickerLabel: {
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: 13,
  },
  monthSelect: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #334155',
    background: '#111827',
    color: '#fff',
    fontWeight: 800,
    outline: 'none',
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
