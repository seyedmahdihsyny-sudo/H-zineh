import 'react-native-url-polyfill/auto';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView,
  Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, View, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mentihhsaenssxgktvmi.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CGDA-fYA_OLWoUfkBcIJwQ_AZqNUlkB';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
    })
  : null;

const money = value => new Intl.NumberFormat('fa-IR').format(Number(value || 0)) + ' تومان';
const tehranDateInput = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateText = value => new Date(value + 'T12:00:00+03:30').toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' });
const dateTimeText = value => new Date(value).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' });

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [displayNameEdit, setDisplayNameEdit] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [tab, setTab] = useState('expenses');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(tehranDateInput());
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [invoiceUrl, setInvoiceUrl] = useState(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    loadData();
    const channel = supabase.channel('h-zineh-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        setNotifications(current => [payload.new, ...current]);
        Alert.alert('اطلاع‌رسانی', payload.new.message || 'هزینه جدید ثبت شد');
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  async function loadData() {
    const [expenseResult, categoryResult, notificationResult, profileResult, profilesResult] = await Promise.all([
      supabase.from('expenses').select('*, expense_categories(name)').order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expense_categories').select('*').order('name'),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40),
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('profiles').select('id,display_name,role')
    ]);
    if (expenseResult.error) Alert.alert('خطا', expenseResult.error.message);
    else setExpenses(expenseResult.data || []);
    if (!categoryResult.error) setCategories(categoryResult.data || []);
    if (!notificationResult.error) setNotifications(notificationResult.data || []);
    if (!profileResult.error) { setProfile(profileResult.data || null); setDisplayNameEdit(profileResult.data?.display_name || ''); }
    if (!profilesResult.error) setProfiles(profilesResult.data || []);
  }

  async function authenticate() {
    const username = email.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username) || !password) return Alert.alert('اطلاعات ناقص', 'نام کاربری و رمز عبور معتبر را وارد کنید.');
    setBusy(true);
    const loginEmail = username === 'junior' ? 'seyedmahdihsyny@gmail.com' : username + '@hzineh.local';
    const result = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setBusy(false);
    if (result.error) Alert.alert('ورود ناموفق', 'نام کاربری یا رمز عبور اشتباه است.');
  }

  async function createPartner() {
    if (!newUsername.trim() || !newPassword || newPassword.length < 8) return Alert.alert('اطلاعات ناقص', 'نام کاربری و رمز حداقل ۸ کاراکتری وارد کنید.');
    setBusy(true);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const result = await supabase.functions.invoke('admin-create-user', {
      body: { username: newUsername.trim().toLowerCase(), password: newPassword, display_name: newDisplayName.trim() },
      headers: { Authorization: 'Bearer ' + currentSession.access_token }
    });
    setBusy(false);
    if (result.error) return Alert.alert('ساخت کاربر ناموفق', result.data?.error || result.error.message);
    setNewUsername(''); setNewPassword(''); setNewDisplayName('');
    Alert.alert('انجام شد', 'حساب کاربر ساخته شد.');
  }

  function resetForm() {
    setTitle(''); setAmount(''); setExpenseDate(tehranDateInput());
    setCategoryId(''); setDescription(''); setInvoice(null); setInvoiceUrl(null);
    setEditing(null); setShowForm(false);
  }

  async function chooseInvoice(camera = false) {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('دسترسی لازم است', 'برای انتخاب تصویر فاکتور اجازه دسترسی بدهید.');
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.65 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.65 });
    if (!result.canceled) setInvoice(result.assets[0]);
  }

  async function createCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setBusy(true);
    const result = await supabase.from('expense_categories').insert({ name }).select().single();
    setBusy(false);
    if (result.error) return Alert.alert('خطا', result.error.message);
    setCategories(current => [...current, result.data]);
    setNewCategory('');
  }

  async function saveProfileSettings() {
    setBusy(true);
    const result = await supabase.from('profiles').update({ display_name: displayNameEdit.trim() }).eq('id', session.user.id);
    setBusy(false);
    if (result.error) return Alert.alert('خطا', result.error.message);
    setProfile(current => ({ ...current, display_name: displayNameEdit.trim() }));
    Alert.alert('ذخیره شد', 'نام نمایشی به‌روزرسانی شد.');
  }

  async function changePassword() {
    if (password.length < 8) return Alert.alert('رمز نامعتبر', 'رمز جدید حداقل ۸ کاراکتر باشد.');
    setBusy(true);
    const result = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (result.error) return Alert.alert('خطا', result.error.message);
    setPassword('');
    Alert.alert('انجام شد', 'رمز عبور تغییر کرد.');
  }

  async function saveExpense() {
    const numericAmount = Number(amount.replace(/[,،٬\s]/g, ''));
    if (!title.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return Alert.alert('اطلاعات ناقص', 'عنوان و مبلغ معتبر را وارد کنید.');
    }
    setBusy(true);
    let invoicePath = editing?.invoice_path || null;
    if (invoice) {
      const extension = (invoice.fileName || invoice.uri.split('.').pop() || 'jpg').split('.').pop().toLowerCase();
      const path = session.user.id + '/' + Date.now() + '.' + (['jpg','jpeg','png','webp'].includes(extension) ? extension : 'jpg');
      try {
        const response = await fetch(invoice.uri);
        if (!response.ok) throw new Error('خواندن تصویر انتخاب‌شده ناموفق بود.');
        const arrayBuffer = await response.arrayBuffer();
        const detectedType = invoice.mimeType || (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'heic' || extension === 'heif' ? 'image/heic' : 'image/jpeg');
        const contentType = ['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(detectedType) ? detectedType : 'image/jpeg';
        const upload = await supabase.storage.from('invoices').upload(path, arrayBuffer, { contentType, upsert: false });
        if (upload.error) { setBusy(false); return Alert.alert('خطای فاکتور', upload.error.message + (upload.error.name ? '\n' + upload.error.name : '')); }
      } catch (error) {
        setBusy(false);
        return Alert.alert('خطای فاکتور', error?.message || 'بارگذاری تصویر انجام نشد.');
      }
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
    resetForm();
    loadData();
  }

  async function editExpense(item) {
    setEditing(item); setTitle(item.title); setAmount(String(item.amount));
    setExpenseDate(item.expense_date); setCategoryId(item.category_id || '');
    setDescription(item.description || ''); setInvoice(null); setInvoiceUrl(null);
    if (item.invoice_path) {
      const { data } = await supabase.storage.from('invoices').createSignedUrl(item.invoice_path, 3600);
      setInvoiceUrl(data?.signedUrl || null);
    }
    setShowForm(true);
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

  async function markRead(item) {
    const result = await supabase.from('notification_reads').upsert({
      notification_id: item.id, user_id: session.user.id
    }, { onConflict: 'notification_id,user_id', ignoreDuplicates: true });
    if (result.error) Alert.alert('خطا', result.error.message);
  }


  if (!supabase) return <SafeAreaView style={s.center}><Text style={s.heading}>تنظیم اتصال ناقص است</Text><Text style={s.muted}>مقادیر EXPO_PUBLIC_SUPABASE_URL و EXPO_PUBLIC_SUPABASE_ANON_KEY را در فایل .env قرار دهید.</Text></SafeAreaView>;
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#167d65" /></View>;

  if (!session) return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.authWrap}>
        <Text style={s.brand}>H-zineh</Text><Text style={s.heading}>مدیریت هزینه‌های کارخانه</Text>
        <Text style={s.muted}>برای ورود، نام کاربری و رمز عبوری را وارد کنید که مدیر در اختیارتان گذاشته است.</Text>
        <TextInput style={s.input} placeholder="نام کاربری" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput style={s.input} placeholder="رمز عبور" secureTextEntry value={password} onChangeText={setPassword} />
        <Pressable style={s.primary} onPress={authenticate} disabled={busy}><Text style={s.primaryText}>{busy ? 'لطفاً صبر کنید…' : 'ورود'}</Text></Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <View><Text style={s.brandSmall}>H-zineh</Text><Text style={s.muted}>مدیریت هزینه‌های کارخانه</Text></View>
        <Pressable onPress={() => supabase.auth.signOut()}><Text style={s.link}>خروج</Text></Pressable>
      </View>
      <View style={s.tabs}>
        <Pressable onPress={() => { setTab('expenses'); setShowForm(false); }} style={[s.tab, tab === 'expenses' && s.activeTab]}><Text style={[s.tabText, tab === 'expenses' && s.activeTabText]}>هزینه‌ها</Text></Pressable>
        <Pressable onPress={() => { setTab('notifications'); setShowForm(false); }} style={[s.tab, tab === 'notifications' && s.activeTab]}><Text style={[s.tabText, tab === 'notifications' && s.activeTabText]}>اعلان‌ها</Text></Pressable>
        <Pressable onPress={() => { setTab('settings'); setShowForm(false); }} style={[s.tab, tab === 'settings' && s.activeTab]}><Text style={[s.tabText, tab === 'settings' && s.activeTabText]}>تنظیمات کاربر</Text></Pressable>
        {profile?.role === 'admin' && <Pressable onPress={() => { setTab('admin'); setShowForm(false); }} style={[s.tab, tab === 'admin' && s.activeTab]}><Text style={[s.tabText, tab === 'admin' && s.activeTabText]}>تنظیمات مدیر</Text></Pressable>}
      </View>
      {tab === 'settings' ? (
        <ScrollView contentContainerStyle={s.form}>
          <Text style={s.sectionTitle}>تنظیمات کاربری</Text>
          <Text style={s.fieldLabel}>نام نمایشی</Text>
          <TextInput style={s.input} placeholder="نام شما" value={displayNameEdit} onChangeText={setDisplayNameEdit} />
          <Pressable style={s.primary} onPress={saveProfileSettings} disabled={busy}><Text style={s.primaryText}>ذخیره نام</Text></Pressable>
          <Text style={s.fieldLabel}>تغییر رمز عبور</Text>
          <TextInput style={s.input} placeholder="رمز جدید (حداقل ۸ کاراکتر)" secureTextEntry value={password} onChangeText={setPassword} />
          <Pressable style={s.secondary} onPress={changePassword} disabled={busy}><Text style={s.secondaryText}>تغییر رمز عبور</Text></Pressable>
          <Pressable style={s.cancel} onPress={() => supabase.auth.signOut()}><Text style={s.danger}>خروج از حساب</Text></Pressable>
        </ScrollView>
      ) : tab === 'admin' && profile?.role === 'admin' ? (
        <ScrollView contentContainerStyle={s.form}>
          <Text style={s.sectionTitle}>تنظیمات مدیر</Text>
          <Text style={s.fieldLabel}>ساخت حساب کاربری جدید</Text>
          <TextInput style={s.input} placeholder="نام نمایشی" value={newDisplayName} onChangeText={setNewDisplayName} />
          <TextInput style={s.input} placeholder="نام کاربری (انگلیسی)" autoCapitalize="none" value={newUsername} onChangeText={setNewUsername} />
          <TextInput style={s.input} placeholder="رمز عبور (حداقل ۸ کاراکتر)" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
          <Pressable style={s.primary} onPress={createPartner} disabled={busy}><Text style={s.primaryText}>{busy ? 'در حال ساخت…' : 'ساخت کاربر'}</Text></Pressable>
          <Text style={s.sectionTitle}>کاربران ثبت‌شده</Text>
          {profiles.map(p => <View key={p.id} style={s.notice}><Text style={s.noticeTitle}>{p.display_name || 'بدون نام'}  •  {p.role === 'admin' ? 'مدیر' : 'کاربر'}</Text></View>)}
          <Text style={s.fieldLabel}>افزودن دسته‌بندی هزینه</Text>
          <TextInput style={s.input} placeholder="نام دسته‌بندی جدید" value={newCategory} onChangeText={setNewCategory} />
          <Pressable style={s.secondary} onPress={createCategory} disabled={busy}><Text style={s.secondaryText}>افزودن دسته‌بندی</Text></Pressable>
        </ScrollView>
      ) : tab === 'expenses' && showForm ? (
        <ScrollView contentContainerStyle={s.form}>
          <Text style={s.sectionTitle}>{editing ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}</Text>
          <TextInput style={s.input} placeholder="عنوان هزینه" value={title} onChangeText={setTitle} />
          <TextInput style={s.input} placeholder="مبلغ (تومان)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <TextInput style={s.input} placeholder="تاریخ (YYYY-MM-DD)" value={expenseDate} onChangeText={setExpenseDate} />
          <Text style={s.fieldLabel}>دسته‌بندی</Text>
          <View style={s.chips}>{categories.map(c => <Pressable key={c.id} onPress={() => setCategoryId(categoryId === c.id ? '' : c.id)} style={[s.chip, categoryId === c.id && s.chipActive]}><Text style={s.chipText}>{c.name}</Text></Pressable>)}</View>
          <TextInput style={[s.input, s.multiline]} placeholder="توضیحات (اختیاری)" multiline value={description} onChangeText={setDescription} />
          <Text style={s.fieldLabel}>تصویر فاکتور</Text>
          {invoice ? <Pressable onPress={() => setPreviewVisible(true)}><Image source={{ uri: invoice.uri }} style={s.invoicePreview} /></Pressable> : invoiceUrl ? <Pressable onPress={() => setPreviewVisible(true)}><Image source={{ uri: invoiceUrl }} style={s.invoicePreview} /></Pressable> : null}
          {(invoice || invoiceUrl) && <Pressable style={s.previewClose} onPress={() => { setInvoice(null); setInvoiceUrl(null); }}><Text style={s.danger}>× حذف تصویر انتخاب‌شده</Text></Pressable>}
          <View style={s.actions}><Pressable style={s.secondary} onPress={() => chooseInvoice(false)}><Text style={s.secondaryText}>انتخاب تصویر</Text></Pressable><Pressable style={s.secondary} onPress={() => chooseInvoice(true)}><Text style={s.secondaryText}>دوربین</Text></Pressable></View>
          <Pressable style={s.primary} onPress={saveExpense} disabled={busy}><Text style={s.primaryText}>{busy ? 'در حال ذخیره…' : 'ذخیره هزینه'}</Text></Pressable>
          <Pressable style={s.cancel} onPress={resetForm}><Text style={s.muted}>انصراف</Text></Pressable>
        </ScrollView>
      ) : tab === 'expenses' ? (
        <>
          <View style={s.listHeading}><Text style={s.sectionTitle}>فهرست هزینه‌ها</Text><Pressable style={s.addButton} onPress={() => { resetForm(); setShowForm(true); }}><Text style={s.addText}>+ ثبت هزینه</Text></Pressable></View>
          <FlatList data={expenses} keyExtractor={item => item.id} contentContainerStyle={s.list} refreshing={busy} onRefresh={loadData}
            ListEmptyComponent={<Text style={s.empty}>هنوز هزینه‌ای ثبت نشده است.</Text>}
            renderItem={({ item }) => <View style={s.expenseCard}>
              <View style={s.cardTop}><Text style={s.expenseTitle}>{item.title}</Text><Text style={s.amount}>{money(item.amount)}</Text></View>
              <Text style={s.muted}>{dateText(item.expense_date)}  •  {item.expense_categories?.name || 'بدون دسته‌بندی'}</Text>
              <Text style={s.muted}>ثبت‌کننده: {profiles.find(p => p.id === item.created_by)?.display_name || (item.created_by === session.user.id ? (profile?.display_name || 'شما') : 'کاربر')}</Text>
              {!!item.description && <Text style={s.description}>{item.description}</Text>}
              {!!item.invoice_path && <Text style={s.link}>فاکتور پیوست شده</Text>}
              {item.created_by === session.user.id && <View style={s.actions}><Pressable onPress={() => editExpense(item)}><Text style={s.link}>ویرایش</Text></Pressable><Pressable onPress={() => deleteExpense(item)}><Text style={s.danger}>حذف</Text></Pressable></View>}
            </View>}
          />
        </>
      ) : (
        <FlatList data={notifications} keyExtractor={item => item.id} contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>اعلانی وجود ندارد.</Text>}
          renderItem={({ item }) => <Pressable style={s.notice} onPress={() => markRead(item)}><Text style={s.noticeTitle}>{item.message}</Text><Text style={s.muted}>{dateTimeText(item.created_at)}</Text><Text style={s.link}>علامت‌گذاری به‌عنوان خوانده‌شده</Text></Pressable>}
        />
      )}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={s.previewBackdrop}>
          <Pressable style={s.previewCloseTop} onPress={() => setPreviewVisible(false)}><Text style={s.previewCloseText}>×</Text></Pressable>
          {(invoice || invoiceUrl) && <Image source={{ uri: invoice?.uri || invoiceUrl }} style={s.fullInvoice} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7f6', direction: 'rtl' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f5f7f6' },
  authWrap: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 32, fontWeight: '900', color: '#126b58', textAlign: 'center', marginBottom: 10 },
  brandSmall: { fontSize: 22, fontWeight: '900', color: '#126b58', textAlign: 'right' },
  heading: { fontSize: 21, fontWeight: '800', color: '#172b25', textAlign: 'center', marginBottom: 8 },
  muted: { color: '#78847f', fontSize: 13, textAlign: 'right', marginVertical: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e8e4', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginTop: 12, textAlign: 'right', color: '#172b25' },
  primary: { backgroundColor: '#167d65', borderRadius: 13, padding: 15, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  link: { color: '#167d65', fontWeight: '700', textAlign: 'right', marginTop: 12 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, borderBottomWidth: 1, borderColor: '#dce5e0' },
  tab: { padding: 12, marginLeft: 8 },
  activeTab: { borderBottomWidth: 3, borderColor: '#167d65' },
  tabText: { color: '#718079', fontWeight: '700' },
  activeTabText: { color: '#126b58' },
  listHeading: { paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1c3029', textAlign: 'right' },
  addButton: { backgroundColor: '#167d65', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  addText: { color: '#fff', fontWeight: '800' },
  list: { paddingHorizontal: 16, paddingBottom: 28 },
  expenseCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#e8eeeb' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  expenseTitle: { color: '#20352d', fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'right' },
  amount: { color: '#167d65', fontWeight: '900', fontSize: 14 },
  description: { color: '#53635b', textAlign: 'right', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 20, alignItems: 'center', marginTop: 12 },
  danger: { color: '#c23b3b', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#87938d', marginTop: 50 },
  form: { padding: 18, paddingBottom: 40 },
  fieldLabel: { textAlign: 'right', color: '#42564d', fontWeight: '700', marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#e7eeea' },
  chipActive: { backgroundColor: '#c8e7dc' },
  chipText: { color: '#245345' },
  multiline: { minHeight: 85, textAlignVertical: 'top' },
  invoicePreview: { width: '100%', height: 180, resizeMode: 'contain', marginTop: 10, borderRadius: 12 },
  secondary: { borderWidth: 1, borderColor: '#167d65', borderRadius: 10, padding: 12, flex: 1, alignItems: 'center' },
  secondaryText: { color: '#167d65', fontWeight: '700' },
  cancel: { alignItems: 'center', padding: 14 },
  notice: { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginBottom: 10 },
  noticeTitle: { color: '#20352d', textAlign: 'right', fontWeight: '800' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  previewCloseTop: { position: 'absolute', top: 48, right: 20, zIndex: 5, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  previewCloseText: { color: '#172b25', fontSize: 32, lineHeight: 36, fontWeight: '700' },
  fullInvoice: { width: '100%', height: '80%', resizeMode: 'contain' },
  previewClose: { alignSelf: 'flex-end', padding: 8 }
});