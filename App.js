import 'react-native-url-polyfill/auto';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking,
  Platform, Pressable, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet,
  Text, TextInput, View, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mentihhsaenssxgktvmi.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CGDA-fYA_OLWoUfkBcIJwQ_AZqNUlkB';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});
const money = value => new Intl.NumberFormat('fa-IR').format(Number(value || 0)) + ' تومان';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateText = value => value ? new Date(value + 'T12:00:00+03:30').toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }) : '—';
const dateTimeText = value => value ? new Date(value).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const palettes = {
  سبز: { bg: '#f3f7f4', card: '#ffffff', primary: '#167d65', text: '#20352d', muted: '#78847f', border: '#e1eae4' },
  آبی: { bg: '#f2f5fa', card: '#ffffff', primary: '#315f9b', text: '#1d2c40', muted: '#718096', border: '#dce5f0' },
  بنفش: { bg: '#f6f3fa', card: '#ffffff', primary: '#7450a5', text: '#30243e', muted: '#82768f', border: '#e8e0ef' },
  تیره: { bg: '#111827', card: '#1f2937', primary: '#38b99a', text: '#f3f4f6', muted: '#aab4c2', border: '#374151' },
  ذغالی: { bg: '#181818', card: '#252525', primary: '#e0a84b', text: '#f4f4f4', muted: '#b0b0b0', border: '#414141' }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('all');
  const [adminPage, setAdminPage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(today());
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [displayNameEdit, setDisplayNameEdit] = useState('');
  const [passwordEdit, setPasswordEdit] = useState('');
  const [contactText, setContactText] = useState('');
  const [contactEdit, setContactEdit] = useState('');
  const [themeName, setThemeName] = useState('سبز');
  const [fontName, setFontName] = useState('پیش‌فرض');
  const [fontScale, setFontScale] = useState(1);
  const [newCategory, setNewCategory] = useState('');

  const theme = palettes[themeName] || palettes.سبز;
  const fontFamily = fontName === 'سریف' ? 'serif' : fontName === 'تک‌فاصله' ? 'monospace' : undefined;
  const Txt = ({ style, ...props }) => { const flat = StyleSheet.flatten(style) || {}; const scaled = flat.fontSize ? { ...flat, fontSize: flat.fontSize * fontScale } : flat; return <Text {...props} style={[fontFamily ? { fontFamily } : null, scaled]} />; };
  const s = useMemo(() => makeStyles(theme, fontFamily, fontScale), [themeName, fontName, fontScale]);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.multiGet(['hz_theme', 'hz_font', 'hz_font_scale']);
      if (saved[0][1] && palettes[saved[0][1]]) setThemeName(saved[0][1]);
      if (saved[1][1]) setFontName(saved[1][1]);
      if (saved[2][1]) setFontScale(Number(saved[2][1]) || 1);
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadData();
    else { setProfile(null); setExpenses([]); }
  }, [session?.user?.id]);

  async function loadData() {
    const [er, cr, pr, prs, sr] = await Promise.all([
      supabase.from('expenses').select('*, expense_categories(name)').order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expense_categories').select('*').order('name'),
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('profiles').select('id,display_name,role,username').order('created_at'),
      supabase.from('app_settings').select('key,value')
    ]);
    if (er.error) Alert.alert('خطا در دریافت هزینه‌ها', er.error.message);
    else setExpenses(er.data || []);
    if (!cr.error) setCategories(cr.data || []);
    if (!pr.error) {
      setProfile(pr.data || null);
      setDisplayNameEdit(pr.data?.display_name || '');
    }
    if (!prs.error) setProfiles(prs.data || []);
    if (!sr.error) {
      const contact = (sr.data || []).find(x => x.key === 'contact_text')?.value || '';
      setContactText(contact); setContactEdit(contact);
    }
  }

  async function loadAdminHistory() {
    const result = await supabase.from('expense_history').select('*').order('created_at', { ascending: false }).limit(300);
    if (result.error) Alert.alert('خطا', result.error.message);
    else setHistory(result.data || []);
  }

  async function authenticate() {
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(clean) || !password) return Alert.alert('اطلاعات ناقص', 'نام کاربری و رمز عبور را وارد کنید.');
    setBusy(true);
    const loginEmail = clean === 'junior' ? 'seyedmahdihsyny@gmail.com' : clean + '@hzineh.local';
    const result = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setBusy(false);
    if (result.error) Alert.alert('ورود ناموفق', 'نام کاربری یا رمز عبور اشتباه است.');
  }

  async function createPartner() {
    if (!newUsername.trim() || !newPassword || newPassword.length < 8) return Alert.alert('اطلاعات ناقص', 'نام کاربری و رمز حداقل ۸ کاراکتری وارد کنید.');
    setBusy(true);
    const { data: { session: current } } = await supabase.auth.getSession();
    const result = await supabase.functions.invoke('admin-create-user', {
      body: { username: newUsername.trim().toLowerCase(), password: newPassword, display_name: newDisplayName.trim() },
      headers: { Authorization: 'Bearer ' + current.access_token }
    });
    setBusy(false);
    if (result.error) return Alert.alert('ساخت کاربر ناموفق', result.data?.error || result.error.message);
    setNewUsername(''); setNewPassword(''); setNewDisplayName('');
    Alert.alert('انجام شد', 'حساب کاربر ساخته شد.'); loadData();
  }

  function resetForm() {
    setTitle(''); setAmount(''); setExpenseDate(today()); setCategoryId('');
    setDescription(''); setInvoice(null); setInvoiceUrl(null); setEditing(null); setShowForm(false);
  }

  async function chooseInvoice(camera = false) {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('دسترسی لازم است', 'برای انتخاب تصویر فاکتور اجازه دسترسی بدهید.');
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.65 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.65 });
    if (!result.canceled) setInvoice(result.assets[0]);
  }

  async function saveExpense() {
    const numericAmount = Number(amount.replace(/[,،٬\s]/g, ''));
    if (!title.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return Alert.alert('اطلاعات ناقص', 'عنوان و مبلغ معتبر را وارد کنید.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return Alert.alert('تاریخ نامعتبر', 'تاریخ را به شکل 2026-11-24 وارد کنید.');
    setBusy(true);
    let invoicePath = editing?.invoice_path || null;
    if (invoice) {
      const extension = (invoice.fileName || invoice.uri.split('.').pop() || 'jpg').split('.').pop().toLowerCase();
      const path = session.user.id + '/' + Date.now() + '.' + (['jpg','jpeg','png','webp','heic','heif'].includes(extension) ? extension : 'jpg');
      try {
        const response = await fetch(invoice.uri);
        const arrayBuffer = await response.arrayBuffer();
        const mime = invoice.mimeType || (extension === 'png' ? 'image/png' : 'image/jpeg');
        const upload = await supabase.storage.from('invoices').upload(path, arrayBuffer, { contentType: mime, upsert: false });
        if (upload.error) { setBusy(false); return Alert.alert('خطای فاکتور', upload.error.message); }
      } catch (e) { setBusy(false); return Alert.alert('خطای فاکتور', e?.message || 'بارگذاری تصویر انجام نشد.'); }
      invoicePath = path;
    }
    const payload = {
      title: title.trim(), amount: numericAmount, expense_date: expenseDate,
      category_id: categoryId || null, partner_id: session.user.id,
      created_by: session.user.id, description: description.trim(), invoice_path: invoicePath
    };
    const result = editing
      ? await supabase.from('expenses').update(payload).eq('id', editing.id)
      : await supabase.from('expenses').insert(payload);
    setBusy(false);
    if (result.error) return Alert.alert('ذخیره ناموفق', result.error.message);
    resetForm(); loadData();
  }

  async function editExpense(item) {
    setEditing(item); setTitle(item.title); setAmount(String(item.amount));
    setExpenseDate(item.expense_date); setCategoryId(item.category_id || '');
    setDescription(item.description || ''); setInvoice(null); setInvoiceUrl(null);
    if (item.invoice_path) {
      const { data } = await supabase.storage.from('invoices').createSignedUrl(item.invoice_path, 3600);
      setInvoiceUrl(data?.signedUrl || null);
    }
    setShowForm(true); setTab('add');
  }

  async function deleteExpense(item) {
    Alert.alert('حذف هزینه', 'از حذف این هزینه مطمئن هستید؟', [
      { text: 'انصراف', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        const result = await supabase.from('expenses').delete().eq('id', item.id);
        if (result.error) Alert.alert('خطا', result.error.message);
        else { if (item.invoice_path) await supabase.storage.from('invoices').remove([item.invoice_path]); loadData(); }
      }}
    ]);
  }

  async function saveProfile() {
    setBusy(true);
    const result = await supabase.from('profiles').update({ display_name: displayNameEdit.trim() }).eq('id', session.user.id);
    setBusy(false);
    if (result.error) return Alert.alert('خطا', result.error.message);
    setProfile(current => ({ ...current, display_name: displayNameEdit.trim() }));
    Alert.alert('ذخیره شد', 'نام نمایشی به‌روزرسانی شد.');
  }

  async function changePassword() {
    if (passwordEdit.length < 8) return Alert.alert('رمز نامعتبر', 'رمز جدید حداقل ۸ کاراکتر باشد.');
    setBusy(true); const result = await supabase.auth.updateUser({ password: passwordEdit }); setBusy(false);
    if (result.error) return Alert.alert('خطا', result.error.message);
    setPasswordEdit(''); Alert.alert('انجام شد', 'رمز عبور تغییر کرد.');
  }

  async function saveContact() {
    setBusy(true);
    const result = await supabase.from('app_settings').upsert({ key: 'contact_text', value: contactEdit.trim(), updated_by: session.user.id }, { onConflict: 'key' });
    setBusy(false);
    if (result.error) return Alert.alert('خطا', result.error.message);
    setContactText(contactEdit.trim()); Alert.alert('ذخیره شد', 'اطلاعات ارتباط با ما به‌روزرسانی شد.');
  }

  async function saveAppearance(key, value) {
    if (key === 'theme') setThemeName(value);
    if (key === 'font') setFontName(value);
    if (key === 'scale') setFontScale(Number(value));
    await AsyncStorage.setItem(key === 'theme' ? 'hz_theme' : key === 'font' ? 'hz_font' : 'hz_font_scale', String(value));
  }

  async function shareApp() {
    try { await Share.share({ message: 'برنامه H-zineh برای مدیریت هزینه‌های کارخانه' }); }
    catch (e) { Alert.alert('خطا', 'اشتراک‌گذاری انجام نشد.'); }
  }

  const myExpenses = useMemo(() => expenses.filter(x => x.created_by === session?.user?.id || x.partner_id === session?.user?.id), [expenses, session?.user?.id]);
  const filteredMine = useMemo(() => myExpenses.filter(x => (!fromDate || x.expense_date >= fromDate) && (!toDate || x.expense_date <= toDate)), [myExpenses, fromDate, toDate]);
  const mineTotal = filteredMine.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const reportExpenses = useMemo(() => expenses.filter(x => (!reportFrom || x.expense_date >= reportFrom) && (!reportTo || x.expense_date <= reportTo)), [expenses, reportFrom, reportTo]);
  const reportUsers = useMemo(() => profiles.map(p => {
    const rows = reportExpenses.filter(x => x.created_by === p.id || x.partner_id === p.id);
    return { profile: p, rows, total: rows.reduce((sum, x) => sum + Number(x.amount || 0), 0) };
  }).filter(x => x.rows.length || profile?.role === 'admin'), [profiles, reportExpenses, profile?.role]);

  async function exportUserReport(group) {
    const rows = group.rows.slice().sort((a,b) => a.expense_date.localeCompare(b.expense_date));
    const body = rows.map(x => '<tr><td>' + escapeHtml(dateText(x.expense_date)) + '</td><td>' + escapeHtml(x.title) + '</td><td>' + escapeHtml(money(x.amount)) + '</td><td>' + escapeHtml(x.description || '') + '</td></tr>').join('');
    const html = '<html lang="fa" dir="rtl"><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h1,h2{text-align:right}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #bbb;padding:9px;text-align:right}th{background:#eee}.total{font-size:18px;font-weight:bold;margin-top:18px}</style><h1>گزارش هزینه‌های H-zineh</h1><h2>کاربر: ' + escapeHtml(group.profile.username || group.profile.display_name || 'بدون نام') + '</h2><p>بازه: ' + escapeHtml(reportFrom || 'ابتدای سوابق') + ' تا ' + escapeHtml(reportTo || 'امروز') + '</p><table><thead><tr><th>تاریخ</th><th>شرح هزینه</th><th>مبلغ</th><th>توضیحات</th></tr></thead><tbody>' + body + '</tbody></table><p class="total">جمع کل: ' + escapeHtml(money(group.total)) + '</p></html>';
    try {
      const file = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'فاکتور هزینه‌های کاربر' });
      else Alert.alert('فایل PDF آماده شد', file.uri);
    } catch (e) { Alert.alert('خطا در ساخت PDF', e?.message || 'ساخت فاکتور انجام نشد.'); }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function historyTitle(item) {
    const data = item.old_data || item.new_data || {};
    const actor = profiles.find(p => p.id === item.actor_id);
    const action = item.action === 'deleted' ? 'حذف کرد' : item.action === 'updated' ? 'ویرایش کرد' : 'ثبت کرد';
    return { data, actor: actor?.username || actor?.display_name || 'کاربر', action };
  }

  async function openAdminPage(page) {
    setAdminPage(page);
    if (page === 'deleted') await loadAdminHistory();
  }

  function expenseCard(item, ownOnly = false) {
    const owner = profiles.find(p => p.id === item.created_by || p.id === item.partner_id);
    const own = item.created_by === session.user.id || item.partner_id === session.user.id;
    return <View key={item.id} style={s.card}>
      <View style={s.cardRow}>
        <Txt style={s.expenseTitle}>{item.title}</Txt>
        <Txt style={s.amount}>{money(item.amount)}</Txt>
      </View>
      <Txt style={s.muted}>{dateText(item.expense_date)}  •  {item.expense_categories?.name || 'بدون دسته‌بندی'}</Txt>
      <Txt style={s.muted}>ثبت‌کننده: {owner?.username || (own ? profile?.username : null) || 'نامشخص'}</Txt>
      {!!item.description && <Txt style={s.description}>{item.description}</Txt>}
      {!!item.invoice_path && <Txt style={s.link}>فاکتور پیوست شده</Txt>}
      {own && <View style={s.actionRow}>
        <Pressable onPress={() => editExpense(item)}><Txt style={s.link}>ویرایش</Txt></Pressable>
        <Pressable onPress={() => deleteExpense(item)}><Txt style={s.danger}>حذف</Txt></Pressable>
      </View>}
    </View>;
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  if (!session) return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle={themeName === 'تیره' || themeName === 'ذغالی' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.authWrap}>
        <Txt style={s.brand}>H-zineh</Txt>
        <Txt style={s.heading}>مدیریت هزینه‌های کارخانه</Txt>
        <Txt style={s.muted}>برای ورود، نام کاربری و رمز عبوری را وارد کنید که مدیر در اختیارتان گذاشته است.</Txt>
        <TextInput style={s.input} placeholder="نام کاربری" placeholderTextColor={theme.muted} autoCapitalize="none" value={username} onChangeText={setUsername} />
        <TextInput style={s.input} placeholder="رمز عبور" placeholderTextColor={theme.muted} secureTextEntry value={password} onChangeText={setPassword} />
        <Pressable style={s.primary} onPress={authenticate} disabled={busy}><Txt style={s.primaryText}>{busy ? 'لطفاً صبر کنید…' : 'ورود'}</Txt></Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  const isAdmin = profile?.role === 'admin';
  const activeLabel = tab === 'all' ? 'هزینه‌ها' : tab === 'add' ? 'ثبت هزینه' : tab === 'mine' ? 'هزینه‌های شما' : 'تنظیمات';

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle={themeName === 'تیره' || themeName === 'ذغالی' ? 'light-content' : 'dark-content'} />
      <View style={s.header}>
        <View><Txt style={s.brandSmall}>H-zineh</Txt><Txt style={s.muted}>مدیریت هزینه‌های کارخانه</Txt></View>
        <Pressable onPress={() => supabase.auth.signOut()}><Txt style={s.link}>خروج</Txt></Pressable>
      </View>

      <View style={s.content}>
        {tab === 'all' && (
          <FlatList data={expenses} keyExtractor={x => x.id} contentContainerStyle={s.list}
            ListHeaderComponent={<View style={s.listHeader}><Txt style={s.sectionTitle}>همه هزینه‌های ثبت‌شده</Txt><Txt style={s.muted}>هزینه‌های ثبت‌شده توسط تمام شرکا</Txt></View>}
            ListEmptyComponent={<Txt style={s.empty}>هنوز هزینه‌ای ثبت نشده است.</Txt>}
            renderItem={({ item }) => expenseCard(item)}
            refreshing={busy} onRefresh={loadData}
          />
        )}

        {tab === 'add' && (
          <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
            <Txt style={s.sectionTitle}>{editing ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}</Txt>
            <Txt style={s.fieldLabel}>شرح خرید</Txt>
            <TextInput style={s.input} placeholder="مثلاً خرید قطعات صنعتی" placeholderTextColor={theme.muted} value={title} onChangeText={setTitle} />
            <Txt style={s.fieldLabel}>مبلغ (تومان)</Txt>
            <TextInput style={s.input} placeholder="مبلغ را وارد کنید" placeholderTextColor={theme.muted} keyboardType="numeric" value={amount} onChangeText={setAmount} />
            <Txt style={s.fieldLabel}>تاریخ (میلادی: YYYY-MM-DD)</Txt>
            <TextInput style={s.input} placeholder="2026-11-24" placeholderTextColor={theme.muted} value={expenseDate} onChangeText={setExpenseDate} />
            <Txt style={s.fieldLabel}>دسته‌بندی</Txt>
            <View style={s.chips}>{categories.map(c => <Pressable key={c.id} onPress={() => setCategoryId(categoryId === c.id ? '' : c.id)} style={[s.chip, categoryId === c.id && s.chipActive]}><Txt style={s.chipText}>{c.name}</Txt></Pressable>)}</View>
            <TextInput style={[s.input, s.multiline]} placeholder="توضیحات (اختیاری)" placeholderTextColor={theme.muted} multiline value={description} onChangeText={setDescription} />
            <Txt style={s.fieldLabel}>تصویر فاکتور</Txt>
            {invoice ? <Pressable onPress={() => setPreviewVisible(true)}><Image source={{ uri: invoice.uri }} style={s.invoicePreview} /></Pressable> : invoiceUrl ? <Pressable onPress={() => setPreviewVisible(true)}><Image source={{ uri: invoiceUrl }} style={s.invoicePreview} /></Pressable> : null}
            <View style={s.actionRow}>
              <Pressable style={s.secondary} onPress={() => chooseInvoice(false)}><Txt style={s.secondaryText}>انتخاب تصویر</Txt></Pressable>
              <Pressable style={s.secondary} onPress={() => chooseInvoice(true)}><Txt style={s.secondaryText}>دوربین</Txt></Pressable>
            </View>
            <Pressable style={s.primary} onPress={saveExpense} disabled={busy}><Txt style={s.primaryText}>{busy ? 'در حال ذخیره…' : 'ذخیره هزینه'}</Txt></Pressable>
            {editing && <Pressable style={s.cancel} onPress={resetForm}><Txt style={s.muted}>انصراف از ویرایش</Txt></Pressable>}
          </ScrollView>
        )}

        {tab === 'mine' && (
          <ScrollView contentContainerStyle={s.form}>
            <Txt style={s.sectionTitle}>هزینه‌های ثبت‌شده شما</Txt>
            <Txt style={s.muted}>برای مشاهده مجموع هزینه در یک بازه، تاریخ شروع و پایان را وارد کنید.</Txt>
            <Txt style={s.fieldLabel}>از تاریخ (YYYY-MM-DD)</Txt>
            <TextInput style={s.input} placeholder="مثلاً 2026-11-01" placeholderTextColor={theme.muted} value={fromDate} onChangeText={setFromDate} />
            <Txt style={s.fieldLabel}>تا تاریخ (YYYY-MM-DD)</Txt>
            <TextInput style={s.input} placeholder="مثلاً 2026-11-30" placeholderTextColor={theme.muted} value={toDate} onChangeText={setToDate} />
            <Pressable style={s.secondary} onPress={() => { setFromDate(''); setToDate(''); }}><Txt style={s.secondaryText}>پاک کردن فیلتر تاریخ</Txt></Pressable>
            <View style={s.totalCard}>
              <Txt style={s.muted}>جمع هزینه‌های این بازه</Txt>
              <Txt style={s.total}>{money(mineTotal)}</Txt>
              <Txt style={s.muted}>تعداد فاکتورها: {filteredMine.length}</Txt>
            </View>
            {filteredMine.length ? filteredMine.map(x => expenseCard(x, true)) : <Txt style={s.empty}>در این بازه هزینه‌ای ثبت نشده است.</Txt>}
          </ScrollView>
        )}

        {tab === 'settings' && !adminPage && (
          <ScrollView contentContainerStyle={s.form}>
            <Txt style={s.sectionTitle}>تنظیمات</Txt>
            <View style={s.card}>
              <Txt style={s.cardTitle}>پروفایل من</Txt>
              <Txt style={s.profileLine}>نام کاربری: {profile?.username || 'ثبت نشده'}</Txt>
              <Txt style={s.profileLine}>نام نمایشی: {profile?.display_name || '—'}</Txt>
              <Txt style={s.profileLine}>نوع حساب: {isAdmin ? 'مدیر اصلی' : 'شریک'}</Txt>
              <Txt style={s.fieldLabel}>نام نمایشی</Txt>
              <TextInput style={s.input} value={displayNameEdit} onChangeText={setDisplayNameEdit} placeholder="نام نمایشی" placeholderTextColor={theme.muted} />
              <Pressable style={s.secondary} onPress={saveProfile} disabled={busy}><Txt style={s.secondaryText}>ذخیره پروفایل</Txt></Pressable>
              <Txt style={s.fieldLabel}>تغییر رمز عبور</Txt>
              <TextInput style={s.input} secureTextEntry value={passwordEdit} onChangeText={setPasswordEdit} placeholder="رمز جدید، حداقل ۸ کاراکتر" placeholderTextColor={theme.muted} />
              <Pressable style={s.secondary} onPress={changePassword} disabled={busy}><Txt style={s.secondaryText}>تغییر رمز عبور</Txt></Pressable>
            </View>

            <View style={s.card}>
              <Txt style={s.cardTitle}>ظاهر برنامه</Txt>
              <Txt style={s.fieldLabel}>انتخاب تم و رنگ</Txt>
              <View style={s.chips}>{Object.keys(palettes).map(name => <Pressable key={name} onPress={() => saveAppearance('theme', name)} style={[s.chip, themeName === name && s.chipActive]}><Txt style={s.chipText}>{name}</Txt></Pressable>)}</View>
              <Txt style={s.fieldLabel}>انتخاب فونت</Txt>
              <View style={s.chips}>{['پیش‌فرض','سریف','تک‌فاصله'].map(name => <Pressable key={name} onPress={() => saveAppearance('font', name)} style={[s.chip, fontName === name && s.chipActive]}><Txt style={s.chipText}>{name}</Txt></Pressable>)}</View>
              <Txt style={s.fieldLabel}>اندازه نوشته</Txt>
              <View style={s.actionRow}>{[{v:0.9,t:'کوچک'},{v:1,t:'معمولی'},{v:1.12,t:'بزرگ'}].map(x => <Pressable key={x.v} style={[s.chip, fontScale === x.v && s.chipActive]} onPress={() => saveAppearance('scale', x.v)}><Txt style={s.chipText}>{x.t}</Txt></Pressable>)}</View>
            </View>

            <View style={s.card}>
              <Txt style={s.cardTitle}>ارتباط و اشتراک‌گذاری</Txt>
              <Txt style={s.muted}>{contactText || 'اطلاعات تماس هنوز توسط مدیر ثبت نشده است.'}</Txt>
              <Pressable style={s.secondary} onPress={() => Alert.alert('ارتباط با ما', contactText || 'اطلاعات تماس ثبت نشده است.')}><Txt style={s.secondaryText}>ارتباط با ما</Txt></Pressable>
              <Pressable style={s.secondary} onPress={shareApp}><Txt style={s.secondaryText}>اشتراک‌گذاری برنامه</Txt></Pressable>
            </View>

            {isAdmin && <View style={s.card}>
              <Txt style={s.cardTitle}>مدیریت مخصوص مدیر اصلی</Txt>
              <Pressable style={s.adminButton} onPress={() => openAdminPage('users')}><Txt style={s.adminText}>ساخت کاربر و فهرست کاربران  ←</Txt></Pressable>
              <Pressable style={s.adminButton} onPress={() => openAdminPage('deleted')}><Txt style={s.adminText}>سوابق حذف‌شده‌ها  ←</Txt></Pressable>
              <Pressable style={s.adminButton} onPress={() => openAdminPage('reports')}><Txt style={s.adminText}>گزارش و فاکتور جداگانه کاربران  ←</Txt></Pressable>
              <Txt style={s.fieldLabel}>اطلاعات ارتباط با ما (قابل تنظیم توسط مدیر)</Txt>
              <TextInput style={[s.input, s.multiline]} multiline value={contactEdit} onChangeText={setContactEdit} placeholder="شماره تماس یا راه ارتباطی" placeholderTextColor={theme.muted} />
              <Pressable style={s.secondary} onPress={saveContact} disabled={busy}><Txt style={s.secondaryText}>ذخیره اطلاعات تماس</Txt></Pressable>
            </View>}
            <Pressable style={s.cancel} onPress={() => supabase.auth.signOut()}><Txt style={s.danger}>خروج از حساب</Txt></Pressable>
          </ScrollView>
        )}

        {tab === 'settings' && adminPage === 'users' && isAdmin && (
          <ScrollView contentContainerStyle={s.form}>
            <Pressable onPress={() => setAdminPage('')}><Txt style={s.link}>← بازگشت به تنظیمات</Txt></Pressable>
            <Txt style={s.sectionTitle}>ساخت کاربر جدید</Txt>
            <TextInput style={s.input} placeholder="نام نمایشی (اختیاری)" placeholderTextColor={theme.muted} value={newDisplayName} onChangeText={setNewDisplayName} />
            <TextInput style={s.input} placeholder="نام کاربری انگلیسی" placeholderTextColor={theme.muted} autoCapitalize="none" value={newUsername} onChangeText={setNewUsername} />
            <TextInput style={s.input} placeholder="رمز عبور حداقل ۸ کاراکتر" placeholderTextColor={theme.muted} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <Pressable style={s.primary} onPress={createPartner} disabled={busy}><Txt style={s.primaryText}>{busy ? 'در حال ساخت…' : 'ساخت کاربر'}</Txt></Pressable>
            <Txt style={s.sectionTitle}>فهرست کاربران</Txt>
            {profiles.map(p => <View key={p.id} style={s.card}><Txt style={s.cardTitle}>{p.username || 'بدون نام کاربری'}</Txt><Txt style={s.muted}>{p.display_name || 'بدون نام نمایشی'} • {p.role === 'admin' ? 'مدیر اصلی' : 'شریک'}</Txt></View>)}
          </ScrollView>
        )}

        {tab === 'settings' && adminPage === 'deleted' && isAdmin && (
          <ScrollView contentContainerStyle={s.form}>
            <Pressable onPress={() => setAdminPage('')}><Txt style={s.link}>← بازگشت به تنظیمات</Txt></Pressable>
            <Txt style={s.sectionTitle}>سوابق حذف و تغییر هزینه‌ها</Txt>
            <Txt style={s.muted}>این سوابق از تاریخچه ثبت‌شده در دیتابیس خوانده می‌شوند.</Txt>
            {history.filter(x => x.action === 'deleted').length === 0 && <Txt style={s.empty}>مورد حذف‌شده‌ای ثبت نشده است.</Txt>}
            {history.filter(x => x.action === 'deleted').map(item => {
              const info = historyTitle(item);
              return <View key={item.id} style={s.card}>
                <Txt style={s.cardTitle}>{info.data.title || 'هزینه بدون عنوان'}</Txt>
                <Txt style={s.muted}>حذف‌کننده: {info.actor}</Txt>
                <Txt style={s.muted}>مبلغ: {money(info.data.amount)}</Txt>
                <Txt style={s.muted}>تاریخ هزینه: {dateText(info.data.expense_date)}</Txt>
                <Txt style={s.muted}>زمان حذف: {dateTimeText(item.created_at)}</Txt>
              </View>;
            })}
          </ScrollView>
        )}

        {tab === 'settings' && adminPage === 'reports' && isAdmin && (
          <ScrollView contentContainerStyle={s.form}>
            <Pressable onPress={() => setAdminPage('')}><Txt style={s.link}>← بازگشت به تنظیمات</Txt></Pressable>
            <Txt style={s.sectionTitle}>گزارش هزینه و فاکتور کاربران</Txt>
            <Txt style={s.fieldLabel}>از تاریخ (YYYY-MM-DD)</Txt>
            <TextInput style={s.input} value={reportFrom} onChangeText={setReportFrom} placeholder="شروع بازه" placeholderTextColor={theme.muted} />
            <Txt style={s.fieldLabel}>تا تاریخ (YYYY-MM-DD)</Txt>
            <TextInput style={s.input} value={reportTo} onChangeText={setReportTo} placeholder="پایان بازه" placeholderTextColor={theme.muted} />
            <Pressable style={s.secondary} onPress={() => { setReportFrom(''); setReportTo(''); }}><Txt style={s.secondaryText}>پاک کردن بازه</Txt></Pressable>
            <View style={s.totalCard}><Txt style={s.muted}>جمع کل هزینه‌های همه کاربران</Txt><Txt style={s.total}>{money(reportExpenses.reduce((sum,x)=>sum+Number(x.amount||0),0))}</Txt></View>
            {reportUsers.map(group => <View key={group.profile.id} style={s.card}>
              <Txt style={s.cardTitle}>{group.profile.username || group.profile.display_name || 'بدون نام'}</Txt>
              <Txt style={s.muted}>تعداد فاکتور: {group.rows.length}</Txt>
              <Txt style={s.amount}>{money(group.total)}</Txt>
              <Pressable style={s.primary} onPress={() => exportUserReport(group)} disabled={!group.rows.length}><Txt style={s.primaryText}>دریافت فاکتور PDF این کاربر</Txt></Pressable>
            </View>)}
          </ScrollView>
        )}
      </View>

      <View style={s.bottomNav}>
        {[{id:'all',label:'هزینه‌ها',glyph:'▤'},{id:'add',label:'ثبت هزینه',glyph:'＋'},{id:'mine',label:'هزینه‌های شما',glyph:'◷'},{id:'settings',label:'تنظیمات',glyph:'⚙'}].map(item => (
          <Pressable key={item.id} style={[s.navItem, tab === item.id && s.navActive]} onPress={() => { setTab(item.id); setAdminPage(''); if (item.id === 'add' && !editing) resetForm(); }}>
            <Txt style={[s.navGlyph, tab === item.id && s.navSelected]}>{item.glyph}</Txt>
            <Txt style={[s.navLabel, tab === item.id && s.navSelected]}>{item.label}</Txt>
          </Pressable>
        ))}
      </View>

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={s.previewBackdrop}>
          <Pressable style={s.previewCloseTop} onPress={() => setPreviewVisible(false)}><Txt style={s.previewCloseText}>×</Txt></Pressable>
          {(invoice || invoiceUrl) && <Image source={{ uri: invoice?.uri || invoiceUrl }} style={s.fullInvoice} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(t, fontFamily, fontScale) {
  const f = fontFamily ? { fontFamily } : {};
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg, direction: 'rtl' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
    authWrap: { flex: 1, justifyContent: 'center', padding: 24 },
    content: { flex: 1 },
    header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    brand: { fontSize: 32, fontWeight: '900', color: t.primary, textAlign: 'center', marginBottom: 10, ...f },
    brandSmall: { fontSize: 22, fontWeight: '900', color: t.primary, textAlign: 'right', ...f },
    heading: { fontSize: 21, fontWeight: '800', color: t.text, textAlign: 'center', marginBottom: 8, ...f },
    muted: { color: t.muted, fontSize: 13, textAlign: 'right', marginVertical: 4, ...f },
    input: { backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginTop: 10, textAlign: 'right', color: t.text, fontFamily, fontSize: 14 * fontScale },
    primary: { backgroundColor: t.primary, borderRadius: 13, padding: 14, alignItems: 'center', marginTop: 14 },
    primaryText: { color: '#fff', fontSize: 14, fontWeight: '800', ...f },
    secondary: { borderWidth: 1, borderColor: t.primary, borderRadius: 11, padding: 12, alignItems: 'center', marginTop: 10, flex: 1 },
    secondaryText: { color: t.primary, fontWeight: '700', ...f },
    link: { color: t.primary, fontWeight: '700', textAlign: 'right', marginTop: 10, ...f },
    danger: { color: '#d34b4b', fontWeight: '700', ...f },
    list: { paddingHorizontal: 16, paddingBottom: 18 },
    listHeader: { paddingVertical: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '900', color: t.text, textAlign: 'right', marginBottom: 8, ...f },
    fieldLabel: { textAlign: 'right', color: t.text, fontWeight: '700', marginTop: 14, ...f },
    card: { backgroundColor: t.card, borderRadius: 15, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: t.border },
    cardTitle: { color: t.text, fontSize: 15, fontWeight: '900', textAlign: 'right', marginBottom: 6, ...f },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    expenseTitle: { color: t.text, fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'right', ...f },
    amount: { color: t.primary, fontWeight: '900', fontSize: 14, ...f },
    description: { color: t.muted, textAlign: 'right', marginTop: 8, ...f },
    actionRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 12 },
    empty: { textAlign: 'center', color: t.muted, marginTop: 35, ...f },
    form: { padding: 16, paddingBottom: 26 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    chip: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border },
    chipActive: { backgroundColor: t.border, borderColor: t.primary },
    chipText: { color: t.text, ...f },
    multiline: { minHeight: 85, textAlignVertical: 'top' },
    invoicePreview: { width: '100%', height: 180, resizeMode: 'contain', marginTop: 10, borderRadius: 12 },
    cancel: { alignItems: 'center', padding: 14 },
    totalCard: { backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 15, padding: 18, marginVertical: 14 },
    total: { fontSize: 22, color: t.primary, fontWeight: '900', textAlign: 'right', marginVertical: 5, ...f },
    profileLine: { color: t.text, textAlign: 'right', marginVertical: 4, ...f },
    adminButton: { padding: 14, backgroundColor: t.bg, borderRadius: 11, marginTop: 9 },
    adminText: { color: t.primary, fontWeight: '800', textAlign: 'right', ...f },
    bottomNav: { flexDirection: 'row', borderTopWidth: 1, borderColor: t.border, backgroundColor: t.card, paddingBottom: Platform.OS === 'android' ? 5 : 2, paddingTop: 7 },
    navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
    navActive: { borderTopWidth: 2, borderColor: t.primary, marginTop: -8, paddingTop: 7 },
    navGlyph: { fontSize: 20, color: t.muted, ...f },
    navLabel: { fontSize: 10, color: t.muted, marginTop: 2, ...f },
    navSelected: { color: t.primary, fontWeight: '900' },
    previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center', padding: 18 },
    previewCloseTop: { position: 'absolute', top: 48, right: 20, zIndex: 5, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    previewCloseText: { color: '#172b25', fontSize: 32, lineHeight: 36, fontWeight: '700' },
    fullInvoice: { width: '100%', height: '80%', resizeMode: 'contain' }
  });
}