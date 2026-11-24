import 'react-native-url-polyfill/auto';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking,
  Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet,
  Text, TextInput, View, Modal
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
const dateText = value => value ? new Date(value + 'T12:00:00+03:30').toLocaleDateString('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', calendar: 'persian', numberingSystem: 'arabext' }) : '—';
const dateTimeText = value => value ? new Date(value).toLocaleString('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', calendar: 'persian', numberingSystem: 'arabext', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const jalaliInput = value => {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value + 'T12:00:00+03:30'));
  const get = type => parts.find(p => p.type === type)?.value || '';
  return get('year') + '/' + get('month') + '/' + get('day');
};
const jalaliToGregorian = value => {
  const digits = String(value).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const m = digits.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!m) return '';
  let jy = Number(m[1]), jm = Number(m[2]), jd = Number(m[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return '';
  jy += 1595;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [0,31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  let gm = 1;
  while (gm <= 12 && gd > monthDays[gm]) { gd -= monthDays[gm]; gm++; }
  return String(gy).padStart(4,'0') + '-' + String(gm).padStart(2,'0') + '-' + String(gd).padStart(2,'0');
};

function decodeBase64ToArrayBuffer(base64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = String(base64 || '').replace(/^data:[^,]+,/, '').replace(/[^A-Za-z0-9+/=]/g, '');
  const output = new Uint8Array(Math.floor(clean.length * 3 / 4) - (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0));
  let buffer = 0, bits = 0, index = 0;
  for (const char of clean) {
    if (char === '=') break;
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[index++] = (buffer >> bits) & 255;
    }
  }
  return output.buffer;
}

const palettes = {
  سبز: { bg: '#eaf6f4', card: '#ffffff', primary: '#078577', text: '#142b35', muted: '#70838a', border: '#c9dfdc' },
  آبی: { bg: '#f2f5fa', card: '#ffffff', primary: '#315f9b', text: '#1d2c40', muted: '#718096', border: '#dce5f0' },
  بنفش: { bg: '#f6f3fa', card: '#ffffff', primary: '#7450a5', text: '#30243e', muted: '#82768f', border: '#e8e0ef' },
  تیره: { bg: '#111827', card: '#1f2937', primary: '#38b99a', text: '#f3f4f6', muted: '#aab4c2', border: '#374151' },
  ذغالی: { bg: '#181818', card: '#252525', primary: '#e0a84b', text: '#f4f4f4', muted: '#b0b0b0', border: '#414141' }
};


const jalaliMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
function getJalaliParts(value) {
  const source = value || today();
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', { timeZone:'Asia/Tehran', year:'numeric', month:'numeric', day:'numeric' }).formatToParts(new Date(source + 'T12:00:00+03:30'));
  const get = type => Number(parts.find(p => p.type === type)?.value || 1);
  return { year:get('year'), month:get('month'), day:get('day') };
}
function jalaliMonthLength(year, month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  const candidate = jalaliToGregorian(String(year) + '/12/30');
  return candidate && jalaliInput(candidate).startsWith(String(year)) ? 30 : 29;
}
function JalaliDatePicker({ label, value, onChange, theme, styles, Txt }) {
  const [opened, setOpened] = useState('');
  const parts = getJalaliParts(value);
  const years = Array.from({ length: 26 }, (_, i) => parts.year - 15 + i);
  const days = Array.from({ length: jalaliMonthLength(parts.year, parts.month) }, (_, i) => i + 1);
  const options = opened === 'year' ? years : opened === 'month' ? jalaliMonths.map((name, i) => ({ label:name, value:i + 1 })) : days;
  const selected = opened === 'year' ? parts.year : opened === 'month' ? parts.month : parts.day;
  function choose(next) {
    const year = opened === 'year' ? next : parts.year;
    const month = opened === 'month' ? next : parts.month;
    const day = Math.min(opened === 'day' ? next : parts.day, jalaliMonthLength(year, month));
    const iso = jalaliToGregorian(String(year) + '/' + String(month).padStart(2,'0') + '/' + String(day).padStart(2,'0'));
    if (iso) onChange(iso);
    setOpened('');
  }
  const display = value ? { year:parts.year, month:jalaliMonths[parts.month - 1], day:parts.day } : { year:'سال', month:'ماه', day:'روز' };
  return <View>
    <Txt style={styles.fieldLabel}>{label}</Txt>
    <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
      {[
        { key:'day', text:display.day },
        { key:'month', text:display.month },
        { key:'year', text:display.year }
      ].map(item => <Pressable key={item.key} onPress={() => setOpened(item.key)} style={{ flex:1, minHeight:48, paddingHorizontal:8, borderWidth:1, borderColor:theme.border, borderRadius:12, backgroundColor:theme.card, alignItems:'center', justifyContent:'center', flexDirection:'row', gap:5 }}>
        <Txt style={{ color:theme.text, fontWeight:'700' }}>{item.text}</Txt>
        <Txt style={{ color:theme.muted, fontSize:11 }}>⌄</Txt>
      </Pressable>)}
    </View>
    <Modal visible={!!opened} transparent animationType="fade" onRequestClose={() => setOpened('')}>
      <Pressable onPress={() => setOpened('')} style={{ flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', padding:28 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor:theme.card, borderRadius:16, padding:14, maxHeight:'70%' }}>
          <Txt style={{ color:theme.text, fontSize:16, fontWeight:'900', textAlign:'right', marginBottom:10 }}>{opened === 'year' ? 'انتخاب سال' : opened === 'month' ? 'انتخاب ماه' : 'انتخاب روز'}</Txt>
          <ScrollView>
            {options.map(option => {
              const val = typeof option === 'object' ? option.value : option;
              const text = typeof option === 'object' ? option.label : String(option);
              return <Pressable key={String(val)} onPress={() => choose(val)} style={{ padding:13, borderRadius:10, backgroundColor:val === selected ? theme.bg : 'transparent' }}>
                <Txt style={{ color:val === selected ? theme.primary : theme.text, textAlign:'center', fontWeight:val === selected ? '900' : '500' }}>{text}</Txt>
              </Pressable>;
            })}
          </ScrollView>
          <Pressable onPress={() => setOpened('')} style={{ padding:12, alignItems:'center' }}><Txt style={{ color:theme.primary, fontWeight:'800' }}>بستن</Txt></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}

export default function App() { return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }

function AppContent() {
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
  const [settingsPage, setSettingsPage] = useState('');
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
  const [previewInvoiceUri, setPreviewInvoiceUri] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [selectedReportUser, setSelectedReportUser] = useState('all');
  const [reportPreset, setReportPreset] = useState('custom');
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
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseVersionEdit, setReleaseVersionEdit] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [releaseNotesEdit, setReleaseNotesEdit] = useState('');
  const currentAppVersion = '1.0.0';
  const apkDownloadUrl = 'https://github.com/seyedmahdihsyny-sudo/H-zineh/releases/latest/download/H-zineh.apk';

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
      const version = (sr.data || []).find(x => x.key === 'release_version')?.value || '';
      const notes = (sr.data || []).find(x => x.key === 'release_notes')?.value || '';
      setReleaseVersion(version); setReleaseVersionEdit(version);
      setReleaseNotes(notes); setReleaseNotesEdit(notes);
      setUpdateAvailable(!!version && version !== currentAppVersion);
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
    try {
      const { data: { session: current }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !current?.access_token) throw new Error(sessionError?.message || 'نشست ورود معتبر نیست؛ دوباره وارد شوید.');
      const result = await supabase.functions.invoke('admin-create-user', {
        body: { username: newUsername.trim().toLowerCase(), password: newPassword, display_name: newDisplayName.trim() },
        headers: { Authorization: 'Bearer ' + current.access_token }
      });
      if (result.error || result.data?.error) throw new Error(result.data?.error || result.error?.message || 'ساخت کاربر انجام نشد.');
      setNewUsername(''); setNewPassword(''); setNewDisplayName('');
      Alert.alert('انجام شد', 'حساب کاربر ساخته شد.');
      await loadData();
    } catch (e) {
      Alert.alert('ساخت کاربر ناموفق', e?.message || 'خطای ناشناخته');
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setTitle(''); setAmount(''); setExpenseDate(today()); setCategoryId('');
    setDescription(''); setInvoice(null); setInvoiceUrl(null); setEditing(null); setShowForm(false);
  }

  async function chooseInvoice(camera = false) {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('دسترسی لازم است', 'برای انتخاب تصویر فاکتور اجازه دسترسی بدهید.');
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled && result.assets?.[0]) {
      try {
        const asset = result.assets[0];
        const width = Number(asset.width || 0);
        const height = Number(asset.height || 0);
        const longestSide = Math.max(width, height);
        const actions = longestSide > 2000
          ? [{ resize: width >= height ? { width: 2000 } : { height: 2000 } }]
          : [];
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          actions,
          { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (!compressed.base64) throw new Error('خروجی فشرده‌شده ساخته نشد.');
        setInvoice({
          ...asset,
          uri: compressed.uri,
          width: compressed.width,
          height: compressed.height,
          base64: compressed.base64,
          mimeType: 'image/jpeg',
          fileName: 'invoice.jpg'
        });
        const approxKB = Math.round(compressed.base64.length * 0.75 / 1024);
        Alert.alert('عکس آماده شد', 'عکس فاکتور فشرده شد. حجم تقریبی: ' + approxKB + ' کیلوبایت');
      } catch (error) {
        Alert.alert('فشرده‌سازی ناموفق', error?.message || 'آماده‌سازی عکس انجام نشد. لطفاً عکس دیگری انتخاب کنید.');
      }
    }
  }

  async function saveExpense() {
    const numericAmount = Number(String(amount).replace(/[,،٬\s]/g, ''));
    if (!title.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return Alert.alert('اطلاعات ناقص', 'عنوان و مبلغ معتبر را وارد کنید.');
    setBusy(true);
    try {
      let invoicePath = editing?.invoice_path || null;
      let newlyUploadedPath = null;
      if (invoice) {
        if (!invoice.base64) throw new Error('اطلاعات تصویر در دسترس نیست؛ دوباره عکس را انتخاب کنید.');
        // Invoice images are converted to compressed JPEG on the device before upload.
        const mime = 'image/jpeg';
        const extension = 'jpg';
        const path = session.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;
        const arrayBuffer = decodeBase64ToArrayBuffer(invoice.base64);
        if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error('محتوای تصویر خالی است؛ لطفاً دوباره انتخاب کنید.');
        if (arrayBuffer.byteLength > 20 * 1024 * 1024) throw new Error('حجم تصویر بیشتر از ۲۰ مگابایت است.');
        // React Native: upload the decoded ArrayBuffer directly.
        // Creating a Blob from ArrayBuffer/ArrayBufferView is unsupported in this runtime.
        const upload = await supabase.storage.from('invoices').upload(path, arrayBuffer, {
          contentType: mime, upsert: false, cacheControl: '3600'
        });
        if (upload.error) throw new Error('ذخیره تصویر در فضای ابری ناموفق بود: ' + upload.error.message);
        invoicePath = path;
        newlyUploadedPath = path;
      }
      const payload = {
        title: title.trim(), amount: numericAmount,
        expense_date: editing ? editing.expense_date : today(),
        category_id: categoryId || null,
        // When an admin edits another user's expense, preserve its original owner.
        partner_id: editing ? editing.partner_id : session.user.id,
        created_by: editing ? editing.created_by : session.user.id,
        description: description.trim(), invoice_path: invoicePath
      };
      const result = editing
        ? await supabase.from('expenses').update(payload).eq('id', editing.id)
        : await supabase.from('expenses').insert(payload);
      if (result.error) {
        if (newlyUploadedPath) await supabase.storage.from('invoices').remove([newlyUploadedPath]);
        throw result.error;
      }
      if (editing?.invoice_path && newlyUploadedPath && editing.invoice_path !== newlyUploadedPath) {
        await supabase.storage.from('invoices').remove([editing.invoice_path]);
      }
      resetForm();
      await loadData();
      Alert.alert('ثبت شد', 'هزینه با موفقیت ذخیره شد.');
    } catch (e) {
      Alert.alert('ذخیره ناموفق', e?.message || 'خطای ناشناخته در ثبت هزینه');
    } finally {
      setBusy(false);
    }
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

  async function openInvoicePreview(item) {
    if (!item?.invoice_path) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from('invoices')
        .createSignedUrl(item.invoice_path, 3600);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('لینک نمایش فاکتور ساخته نشد.');
      setPreviewInvoiceUri(data.signedUrl);
      setPreviewVisible(true);
    } catch (error) {
      Alert.alert('نمایش فاکتور ناموفق بود', error?.message || 'دسترسی به تصویر امکان‌پذیر نیست.');
    } finally {
      setBusy(false);
    }
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

  async function saveReleaseInfo() {
    const version = releaseVersionEdit.trim();
    if (!/^\\d+\\.\\d+\\.\\d+$/.test(version)) {
      return Alert.alert('نسخه نامعتبر', 'شماره نسخه را با قالب 1.0.1 وارد کنید.');
    }
    setBusy(true);
    const rows = [
      { key: 'release_version', value: version, updated_by: session.user.id },
      { key: 'release_notes', value: releaseNotesEdit.trim(), updated_by: session.user.id }
    ];
    const result = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
    setBusy(false);
    if (result.error) return Alert.alert('خطا', result.error.message);
    setReleaseVersion(version); setReleaseNotes(releaseNotesEdit.trim());
    setUpdateAvailable(version !== currentAppVersion);
    Alert.alert('ذخیره شد', 'اطلاعات نسخه جدید برای کاربران ثبت شد.');
  }

  async function downloadLatestApk() {
    try { await Linking.openURL(apkDownloadUrl); }
    catch { Alert.alert('خطا', 'باز کردن لینک دانلود ممکن نشد.'); }
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
  }).filter(x => x.rows.length), [profiles, reportExpenses]);
  const selectedReportGroup = selectedReportUser === 'all' ? { profile: { id: 'all', username: 'همه کاربران' }, rows: reportExpenses, total: reportExpenses.reduce((sum,x)=>sum+Number(x.amount||0),0) } : reportUsers.find(x => x.profile.id === selectedReportUser);

  async function exportUserReport(group) {
    const rows = group.rows.slice().sort((a,b) => a.expense_date.localeCompare(b.expense_date));
    const body = rows.map(x => { const owner = profiles.find(p => p.id === (x.created_by || x.partner_id)); return '<tr><td>' + escapeHtml(dateText(x.expense_date)) + '</td><td>' + escapeHtml(owner?.username || owner?.display_name || '—') + '</td><td>' + escapeHtml(x.title) + '</td><td>' + escapeHtml(money(x.amount)) + '</td><td>' + escapeHtml(x.description || '') + '</td></tr>'; }).join('');
    const html = '<html lang="fa" dir="rtl"><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h1,h2{text-align:right}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #bbb;padding:9px;text-align:right}th{background:#eee}.total{font-size:18px;font-weight:bold;margin-top:18px}</style><h1>گزارش هزینه‌های H-zineh</h1><h2>کاربر: ' + escapeHtml(group.profile.username || group.profile.display_name || 'بدون نام') + '</h2><p>بازه: ' + escapeHtml(reportFrom ? dateText(reportFrom) : 'ابتدای سوابق') + ' تا ' + escapeHtml(reportTo ? dateText(reportTo) : 'امروز') + '</p><table><thead><tr><th>تاریخ شمسی</th><th>ثبت‌کننده</th><th>شرح هزینه</th><th>مبلغ</th><th>توضیحات</th></tr></thead><tbody>' + body + '</tbody></table><p class="total">جمع کل: ' + escapeHtml(money(group.total)) + '</p></html>';
    try {
      const file = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'فاکتور هزینه‌های کاربر' });
      else Alert.alert('فایل PDF آماده شد', file.uri);
    } catch (e) { Alert.alert('خطا در ساخت PDF', e?.message || 'ساخت فاکتور انجام نشد.'); }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function applyReportPreset(preset) {
    const now = new Date(today() + 'T00:00:00Z');
    const iso = d => d.toISOString().slice(0, 10);
    const startMonth = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const endMonth = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    let from = '', to = iso(now);
    if (preset === 'today') from = to;
    else if (preset === 'yesterday') { const d = new Date(now); d.setUTCDate(d.getUTCDate() - 1); from = to = iso(d); }
    else if (preset === '7days') { const d = new Date(now); d.setUTCDate(d.getUTCDate() - 6); from = iso(d); }
    else if (preset === 'month') from = iso(startMonth(now));
    else if (preset === 'lastMonth') { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)); from = iso(d); to = iso(endMonth(d)); }
    else if (preset === 'year') from = now.getUTCFullYear() + '-01-01';
    else { from = ''; to = ''; }
    setReportFrom(from); setReportTo(to); setReportPreset(preset);
  }

  async function deleteHistoryItem(item) {
    Alert.alert('حذف سابقه', 'این ردیف از سوابق حذف برای همیشه پاک شود؟ این کار هزینه اصلی را تغییر نمی‌دهد.', [
      { text: 'انصراف', style: 'cancel' },
      { text: 'حذف سابقه', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          const result = await supabase.from('expense_history').delete().eq('id', item.id);
          if (result.error) throw result.error;
          setHistory(prev => prev.filter(x => x.id !== item.id));
          Alert.alert('انجام شد', 'سابقه حذف شد.');
        } catch (e) {
          Alert.alert('حذف ناموفق', e?.message || 'حذف سابقه انجام نشد.');
        } finally {
          setBusy(false);
        }
      }}
    ]);
  }


  async function deleteAllHistory() {
    if (profile?.role !== 'admin') return Alert.alert('دسترسی محدود', 'فقط مدیر اصلی اجازه حذف تاریخچه را دارد.');
    Alert.alert('حذف کل تاریخچه', 'تمام سوابق حذف و تغییرات پاک شوند؟ هزینه‌های اصلی دست‌نخورده باقی می‌مانند.', [
      { text:'انصراف', style:'cancel' },
      { text:'حذف همه سوابق', style:'destructive', onPress: async () => {
        setBusy(true);
        try {
          const result = await supabase.from('expense_history').delete().gte('created_at', '1900-01-01T00:00:00Z');
          if (result.error) throw result.error;
          setHistory([]);
          Alert.alert('انجام شد', 'تمام سوابق تاریخچه پاک شدند؛ هزینه‌های اصلی تغییری نکردند.');
        } catch (e) {
          Alert.alert('حذف ناموفق', e?.message || 'پاک کردن تاریخچه انجام نشد.');
        } finally { setBusy(false); }
      }}
    ]);
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
      {!!item.invoice_path && <Pressable onPress={() => openInvoicePreview(item)} hitSlop={8}><Txt style={s.link}>فاکتور پیوست شده</Txt></Pressable>}
      {(own || isAdmin) && <View style={s.actionRow}>
        <Pressable onPress={() => editExpense(item)}><Txt style={s.link}>ویرایش</Txt></Pressable>
        <Pressable onPress={() => deleteExpense(item)}><Txt style={s.danger}>حذف</Txt></Pressable>
      </View>}
    </View>;
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
  if (!session) return (
    <SafeAreaView style={s.screen} edges={['top','right','bottom','left']}>
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
    <SafeAreaView style={s.screen} edges={['top','right','bottom','left']}>
      <StatusBar barStyle={themeName === 'تیره' || themeName === 'ذغالی' ? 'light-content' : 'dark-content'} />
      <View style={s.header}>
        <View><Txt style={s.brandSmall}>H-zineh</Txt><Txt style={s.muted}>مدیریت هزینه‌های کارخانه</Txt></View>
        <View style={s.actionRow}><Pressable onPress={() => supabase.auth.signOut()}><Txt style={s.link}>خروج</Txt></Pressable></View>
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
            <Txt style={s.muted}>تاریخ و ساعت ثبت این هزینه به‌صورت خودکار از زمان سرور ثبت می‌شود و قابل تغییر نیست.</Txt>
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
            <JalaliDatePicker label="از تاریخ" value={fromDate} onChange={setFromDate} theme={theme} styles={s} Txt={Txt} />
            <JalaliDatePicker label="تا تاریخ" value={toDate} onChange={setToDate} theme={theme} styles={s} Txt={Txt} />
            <Pressable style={s.secondary} onPress={() => { setFromDate(''); setToDate(''); }}><Txt style={s.secondaryText}>پاک کردن فیلتر تاریخ</Txt></Pressable>
            <View style={s.totalCard}>
              <Txt style={s.muted}>جمع هزینه‌های این بازه</Txt>
              <Txt style={s.total}>{money(mineTotal)}</Txt>
              <Txt style={s.muted}>تعداد فاکتورها: {filteredMine.length}</Txt>
            </View>
            {filteredMine.length ? filteredMine.map(x => expenseCard(x, true)) : <Txt style={s.empty}>در این بازه هزینه‌ای ثبت نشده است.</Txt>}
          </ScrollView>
        )}

        {tab === 'settings' && !adminPage && !settingsPage && (
          <ScrollView contentContainerStyle={s.form}>
            <Txt style={s.sectionTitle}>تنظیمات</Txt>
            {updateAvailable && <View style={[s.card,{borderWidth:1,borderColor:theme.primary}]}>
              <Txt style={s.cardTitle}>به‌روزرسانی در دسترس است</Txt>
              <Txt style={s.muted}>نسخه {releaseVersion} آماده دریافت است.</Txt>
              {!!releaseNotes && <Txt style={s.description}>{releaseNotes}</Txt>}
              <Pressable style={s.primary} onPress={downloadLatestApk}><Txt style={s.primaryText}>دریافت نسخه جدید</Txt></Pressable>
            </View>}
            <Pressable style={s.settingsRow} onPress={() => setSettingsPage('profile')}>
              <View style={s.settingsRowText}><Txt style={s.cardTitle}>حساب کاربری</Txt><Txt style={s.muted}>اطلاعات حساب و تغییر رمز عبور</Txt></View><Txt style={s.settingsArrow}>‹</Txt>
            </Pressable>
            <Pressable style={s.settingsRow} onPress={() => setSettingsPage('theme')}>
              <View style={s.settingsRowText}><Txt style={s.cardTitle}>تم و رنگ برنامه</Txt><Txt style={s.muted}>رنگ، حالت روشن و تیره، فونت و اندازه نوشته</Txt></View><Txt style={s.settingsArrow}>‹</Txt>
            </Pressable>
            <Pressable style={s.settingsRow} onPress={() => setSettingsPage('contact')}>
              <View style={s.settingsRowText}><Txt style={s.cardTitle}>ارتباط با ما</Txt><Txt style={s.muted}>اطلاعات تماس</Txt></View><Txt style={s.settingsArrow}>‹</Txt>
            </Pressable>
            <Pressable style={s.settingsRow} onPress={shareApp}>
              <View style={s.settingsRowText}><Txt style={s.cardTitle}>اشتراک‌گذاری برنامه</Txt><Txt style={s.muted}>معرفی H-zineh به دیگران</Txt></View><Txt style={s.settingsArrow}>‹</Txt>
            </Pressable>
            {isAdmin && <Pressable style={s.settingsRow} onPress={() => setSettingsPage('admin')}>
              <View style={s.settingsRowText}><Txt style={s.cardTitle}>مدیریت برنامه</Txt><Txt style={s.muted}>کاربران، گزارش‌ها، دسته‌بندی‌ها و سوابق</Txt></View><Txt style={s.settingsArrow}>‹</Txt>
            </Pressable>}
            <Pressable style={s.cancel} onPress={() => supabase.auth.signOut()}><Txt style={s.danger}>خروج از حساب</Txt></Pressable>
          </ScrollView>
        )}

        {tab === 'settings' && settingsPage === 'profile' && !adminPage && (
          <ScrollView contentContainerStyle={s.form}>
            <View style={s.subpageTop}><Pressable style={s.backButton} onPress={() => setSettingsPage('')}><Txt style={s.backText}>→</Txt></Pressable><Txt style={s.subpageCaption}>بازگشت به تنظیمات</Txt></View>
            <Txt style={s.sectionTitle}>حساب کاربری</Txt>
            <View style={s.card}>
              <Txt style={s.profileLine}>نام کاربری: {profile?.username || 'ثبت نشده'}</Txt>
              <Txt style={s.profileLine}>نام نمایشی: {profile?.display_name || '—'}</Txt>
              <Txt style={s.profileLine}>نوع حساب: {isAdmin ? 'مدیر اصلی' : 'شریک'}</Txt>
              <Txt style={s.fieldLabel}>نام نمایشی</Txt>
              <TextInput style={s.input} value={displayNameEdit} onChangeText={setDisplayNameEdit} placeholder="نام نمایشی" placeholderTextColor={theme.muted} />
              <Pressable style={s.secondary} onPress={saveProfile} disabled={busy}><Txt style={s.secondaryText}>ذخیره پروفایل</Txt></Pressable>
            </View>
            <View style={s.card}>
              <Txt style={s.cardTitle}>تغییر رمز عبور</Txt>
              <TextInput style={s.input} secureTextEntry value={passwordEdit} onChangeText={setPasswordEdit} placeholder="رمز جدید، حداقل ۸ کاراکتر" placeholderTextColor={theme.muted} />
              <Pressable style={s.primary} onPress={changePassword} disabled={busy}><Txt style={s.primaryText}>تغییر رمز عبور</Txt></Pressable>
            </View>
          </ScrollView>
        )}

        {tab === 'settings' && settingsPage === 'theme' && !adminPage && (
          <ScrollView contentContainerStyle={s.form}>
            <View style={s.subpageTop}><Pressable style={s.backButton} onPress={() => setSettingsPage('')}><Txt style={s.backText}>→</Txt></Pressable><Txt style={s.subpageCaption}>بازگشت به تنظیمات</Txt></View>
            <Txt style={s.sectionTitle}>تم و رنگ برنامه</Txt>
            <Txt style={s.muted}>رنگ دلخواه برنامه را انتخاب کنید.</Txt>
            <View style={s.card}><View style={s.chips}>{Object.keys(palettes).map(name => <Pressable key={name} onPress={() => saveAppearance('theme', name)} style={[s.chip, themeName === name && s.chipActive]}><Txt style={s.chipText}>{name}</Txt></Pressable>)}</View></View>
            <Txt style={s.sectionTitle}>فونت برنامه</Txt>
            <View style={s.card}><View style={s.chips}>{['پیش‌فرض','سریف','تک‌فاصله'].map(name => <Pressable key={name} onPress={() => saveAppearance('font', name)} style={[s.chip, fontName === name && s.chipActive]}><Txt style={s.chipText}>{name}</Txt></Pressable>)}</View></View>
            <Txt style={s.sectionTitle}>اندازه نوشته</Txt>
            <View style={s.card}><View style={s.actionRow}>{[{v:0.9,t:'کوچک'},{v:1,t:'معمولی'},{v:1.12,t:'بزرگ'}].map(x => <Pressable key={x.v} style={[s.chip, fontScale === x.v && s.chipActive]} onPress={() => saveAppearance('scale', x.v)}><Txt style={s.chipText}>{x.t}</Txt></Pressable>)}</View></View>
          </ScrollView>
        )}

        {tab === 'settings' && settingsPage === 'contact' && !adminPage && (
          <ScrollView contentContainerStyle={s.form}>
            <View style={s.subpageTop}><Pressable style={s.backButton} onPress={() => setSettingsPage('')}><Txt style={s.backText}>→</Txt></Pressable><Txt style={s.subpageCaption}>بازگشت به تنظیمات</Txt></View>
            <Txt style={s.sectionTitle}>ارتباط با ما</Txt>
            <View style={s.card}>
              <Txt style={s.muted}>{contactText || 'اطلاعات تماس هنوز توسط مدیر ثبت نشده است.'}</Txt>
              <Pressable style={s.secondary} onPress={() => Alert.alert('ارتباط با ما', contactText || 'اطلاعات تماس ثبت نشده است.')}><Txt style={s.secondaryText}>مشاهده اطلاعات تماس</Txt></Pressable>
              {isAdmin && <>
                <Txt style={s.fieldLabel}>ویرایش اطلاعات ارتباط با ما</Txt>
                <TextInput style={[s.input, s.multiline]} multiline value={contactEdit} onChangeText={setContactEdit} placeholder="شماره تماس یا راه ارتباطی" placeholderTextColor={theme.muted} />
                <Pressable style={s.primary} onPress={saveContact} disabled={busy}><Txt style={s.primaryText}>ذخیره اطلاعات تماس</Txt></Pressable>
              </>}
            </View>
          </ScrollView>
        )}

        {tab === 'settings' && settingsPage === 'admin' && !adminPage && isAdmin && (
          <ScrollView contentContainerStyle={s.form}>
            <View style={s.subpageTop}><Pressable style={s.backButton} onPress={() => setSettingsPage('')}><Txt style={s.backText}>→</Txt></Pressable><Txt style={s.subpageCaption}>بازگشت به تنظیمات</Txt></View>
            <Txt style={s.sectionTitle}>مدیریت برنامه</Txt>
            <View style={s.card}>
              <Txt style={s.cardTitle}>انتشار به‌روزرسانی</Txt>
              <Txt style={s.muted}>شماره نسخه جدید و توضیحات را وارد کنید. فایل APK باید در GitHub Release با نام H-zineh.apk قرار گرفته باشد.</Txt>
              <TextInput style={s.input} value={releaseVersionEdit} onChangeText={setReleaseVersionEdit} placeholder="مثلاً 1.0.1" placeholderTextColor={theme.muted} autoCapitalize="none" />
              <TextInput style={[s.input,s.multiline]} value={releaseNotesEdit} onChangeText={setReleaseNotesEdit} placeholder="توضیحات نسخه (اختیاری)" placeholderTextColor={theme.muted} multiline />
              <Pressable style={s.primary} onPress={saveReleaseInfo} disabled={busy}><Txt style={s.primaryText}>{busy ? 'در حال ذخیره…' : 'اعلان نسخه جدید به کاربران'}</Txt></Pressable>
              <Pressable style={s.secondary} onPress={downloadLatestApk}><Txt style={s.secondaryText}>آزمایش لینک دانلود مستقیم</Txt></Pressable>
            </View>
            <Pressable style={s.settingsRow} onPress={() => openAdminPage('users')}><View style={s.settingsRowText}><Txt style={s.cardTitle}>کاربران و دسته‌بندی‌ها</Txt><Txt style={s.muted}>ساخت و مشاهده کاربران و مدیریت دسته‌ها</Txt></View><Txt style={s.settingsArrow}>‹</Txt></Pressable>
            <Pressable style={s.settingsRow} onPress={() => openAdminPage('deleted')}><View style={s.settingsRowText}><Txt style={s.cardTitle}>سوابق حذف و تغییرات</Txt><Txt style={s.muted}>مشاهده تاریخچه عملیات هزینه‌ها</Txt></View><Txt style={s.settingsArrow}>‹</Txt></Pressable>
            <Pressable style={s.settingsRow} onPress={() => openAdminPage('reports')}><View style={s.settingsRowText}><Txt style={s.cardTitle}>گزارش و فاکتور کاربران</Txt><Txt style={s.muted}>گزارش جداگانه هر کاربر در بازه دلخواه</Txt></View><Txt style={s.settingsArrow}>‹</Txt></Pressable>
          </ScrollView>
        )}

        {tab === 'settings' && settingsPage === 'admin' && adminPage === 'users' && isAdmin && (
          <ScrollView contentContainerStyle={s.form}>
            <View style={s.subpageTop}><Pressable style={s.backButton} onPress={() => { setAdminPage(''); setSettingsPage('admin'); }}><Txt style={s.backText}>→</Txt></Pressable><Txt style={s.subpageCaption}>بازگشت به تنظیمات</Txt></View>
            <Txt style={s.sectionTitle}>ساخت کاربر جدید</Txt>
            <TextInput style={s.input} placeholder="نام نمایشی (اختیاری)" placeholderTextColor={theme.muted} value={newDisplayName} onChangeText={setNewDisplayName} />
            <TextInput style={s.input} placeholder="نام کاربری انگلیسی" placeholderTextColor={theme.muted} autoCapitalize="none" value={newUsername} onChangeText={setNewUsername} />
            <TextInput style={s.input} placeholder="رمز عبور حداقل ۸ کاراکتر" placeholderTextColor={theme.muted} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <Pressable style={s.primary} onPress={createPartner} disabled={busy}><Txt style={s.primaryText}>{busy ? 'در حال ساخت…' : 'ساخت کاربر'}</Txt></Pressable>
            <Txt style={s.sectionTitle}>فهرست کاربران</Txt>
            {profiles.map(p => <View key={p.id} style={s.card}><Txt style={s.cardTitle}>{p.username || 'بدون نام کاربری'}</Txt><Txt style={s.muted}>{p.display_name || 'بدون نام نمایشی'} • {p.role === 'admin' ? 'مدیر اصلی' : 'شریک'}</Txt></View>)}
            <Txt style={s.sectionTitle}>دسته‌بندی هزینه‌ها</Txt>
            <TextInput style={s.input} placeholder="نام دسته‌بندی جدید" placeholderTextColor={theme.muted} value={newCategory} onChangeText={setNewCategory} />
            <Pressable style={s.secondary} onPress={createCategory} disabled={busy}><Txt style={s.secondaryText}>افزودن دسته‌بندی</Txt></Pressable>
            {categories.map(item => <View key={item.id} style={s.card}><Txt style={s.profileLine}>{item.name}</Txt></View>)}
          </ScrollView>
        )}

        {tab === 'settings' && settingsPage === 'admin' && adminPage === 'deleted' && isAdmin && (
          <ScrollView contentContainerStyle={s.form}>
            <View style={s.subpageTop}><Pressable style={s.backButton} onPress={() => { setAdminPage(''); setSettingsPage('admin'); }}><Txt style={s.backText}>→</Txt></Pressable><Txt style={s.subpageCaption}>بازگشت به تنظیمات</Txt></View>
            <Txt style={s.sectionTitle}>سوابق حذف و تغییر هزینه‌ها</Txt>
            <Txt style={s.muted}>این سوابق از تاریخچه ثبت‌شده در دیتابیس خوانده می‌شوند.</Txt>
            <Pressable style={s.dangerButton} onPress={deleteAllHistory} disabled={busy}><Txt style={s.dangerText}>{busy ? 'در حال حذف…' : 'حذف همه تاریخچه'}</Txt></Pressable>
            {history.filter(x => x.action === 'deleted').length === 0 && <Txt style={s.empty}>مورد حذف‌شده‌ای ثبت نشده است.</Txt>}
            {history.filter(x => x.action === 'deleted').map(item => {
              const info = historyTitle(item);
              return <View key={item.id} style={s.card}>
                <Txt style={s.cardTitle}>{info.data.title || 'هزینه بدون عنوان'}</Txt>
                <Txt style={s.muted}>حذف‌کننده: {info.actor}</Txt>
                <Txt style={s.muted}>مبلغ: {money(info.data.amount)}</Txt>
                <Txt style={s.muted}>تاریخ هزینه: {dateText(info.data.expense_date)}</Txt>
                <Txt style={s.muted}>زمان حذف: {dateTimeText(item.created_at)}</Txt>
                <Pressable style={s.dangerButton} onPress={() => deleteHistoryItem(item)} disabled={busy}><Txt style={s.dangerText}>حذف این سابقه</Txt></Pressable>
              </View>;
            })}
          </ScrollView>
        )}

        {tab === 'settings' && settingsPage === 'admin' && adminPage === 'reports' && isAdmin && (
          <ScrollView contentContainerStyle={s.form}>
            <View style={s.subpageTop}><Pressable style={s.backButton} onPress={() => { setAdminPage(''); setSettingsPage('admin'); }}><Txt style={s.backText}>→</Txt></Pressable><Txt style={s.subpageCaption}>بازگشت به تنظیمات</Txt></View>
            <Txt style={s.sectionTitle}>گزارش هزینه و فاکتور کاربران</Txt>
            <Txt style={s.fieldLabel}>نوع فیلتر تاریخ</Txt>
            <View style={s.chips}>
              {[['today','امروز'],['yesterday','دیروز'],['7days','۷ روز اخیر'],['month','ماه جاری'],['lastMonth','ماه قبل'],['year','سال جاری'],['custom','بازه دلخواه']].map(([key,label]) => <Pressable key={key} style={[s.chip, reportPreset === key && s.chipActive]} onPress={() => applyReportPreset(key)}><Txt style={s.chipText}>{label}</Txt></Pressable>)}
            </View>
            <JalaliDatePicker label="از تاریخ" value={reportFrom} onChange={value => { setReportFrom(value); setReportPreset('custom'); }} theme={theme} styles={s} Txt={Txt} />
            <JalaliDatePicker label="تا تاریخ" value={reportTo} onChange={value => { setReportTo(value); setReportPreset('custom'); }} theme={theme} styles={s} Txt={Txt} />
            <Pressable style={s.secondary} onPress={() => applyReportPreset('custom')}><Txt style={s.secondaryText}>پاک کردن فیلتر تاریخ</Txt></Pressable>
            <Txt style={s.fieldLabel}>انتخاب گزارش</Txt>
            <View style={s.chips}>
              <Pressable style={[s.chip, selectedReportUser === 'all' && s.chipActive]} onPress={() => setSelectedReportUser('all')}><Txt style={s.chipText}>همه کاربران</Txt></Pressable>
              {reportUsers.map(group => <Pressable key={group.profile.id} style={[s.chip, selectedReportUser === group.profile.id && s.chipActive]} onPress={() => setSelectedReportUser(group.profile.id)}><Txt style={s.chipText}>{group.profile.username || group.profile.display_name || 'بدون نام'}</Txt></Pressable>)}
            </View>
            {selectedReportGroup && <View style={s.totalCard}><Txt style={s.muted}>گزارش: {selectedReportGroup.profile.username}</Txt><Txt style={s.muted}>تعداد فاکتور: {selectedReportGroup.rows.length}</Txt><Txt style={s.total}>{money(selectedReportGroup.total)}</Txt><Pressable style={s.primary} onPress={() => exportUserReport(selectedReportGroup)} disabled={!selectedReportGroup.rows.length}><Txt style={s.primaryText}>ساخت و دریافت فاکتور PDF</Txt></Pressable></View>}
          </ScrollView>
        )}
      </View>

      <View style={s.bottomNav}>
        {[{id:'all',label:'هزینه‌ها',glyph:'▤'},{id:'add',label:'ثبت هزینه',glyph:'＋'},{id:'mine',label:'هزینه‌های شما',glyph:'◷'},{id:'settings',label:'تنظیمات',glyph:'⚙'}].map(item => (
          <Pressable key={item.id} style={[s.navItem, tab === item.id && s.navActive]} onPress={() => { setTab(item.id); setAdminPage(''); setSettingsPage(''); if (item.id === 'add' && !editing) resetForm(); }}>
            <Txt style={[s.navGlyph, tab === item.id && s.navSelected]}>{item.glyph}</Txt>
            <Txt style={[s.navLabel, tab === item.id && s.navSelected]}>{item.label}</Txt>
          </Pressable>
        ))}
      </View>

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => { setPreviewVisible(false); setPreviewInvoiceUri(null); }}>
        <View style={s.previewBackdrop}>
          <Pressable style={s.previewCloseTop} onPress={() => { setPreviewVisible(false); setPreviewInvoiceUri(null); }}><Txt style={s.previewCloseText}>←</Txt></Pressable>
          {(previewInvoiceUri || invoice || invoiceUrl) && <Image source={{ uri: previewInvoiceUri || invoice?.uri || invoiceUrl }} style={s.fullInvoice} />}
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
    dangerButton: { borderWidth: 1, borderColor: '#d34b4b', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 10, marginBottom: 14 },
    dangerText: { color: '#d34b4b', fontWeight: '800', ...f },
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
    form: { padding: 16, paddingBottom: 20 },
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
    settingsRow: { backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingsRowText: { flex: 1 },
    settingsArrow: { color: t.primary, fontSize: 30, fontWeight: '700', marginLeft: 8 },
    adminButton: { padding: 14, backgroundColor: t.bg, borderRadius: 11, marginTop: 9 },
    adminText: { color: t.primary, fontWeight: '800', textAlign: 'right', ...f },
    subpageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 14 },
    backButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    backText: { color: t.primary, fontSize: 27, fontWeight: '900' },
    subpageCaption: { color: t.muted, marginLeft: 10, fontSize: 12, ...f },
    bottomNav: { flexDirection: 'row', borderTopWidth: 1, borderColor: t.border, backgroundColor: t.card, paddingBottom: 8, paddingTop: 8, minHeight: 68 },
    navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 13, marginHorizontal: 3 },
    navActive: { backgroundColor: t.bg, borderTopWidth: 0, marginTop: 0, paddingTop: 7 },
    navGlyph: { fontSize: 20, color: t.muted, ...f },
    navLabel: { fontSize: 10, color: t.muted, marginTop: 2, ...f },
    navSelected: { color: t.primary, fontWeight: '900' },
    previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center', padding: 18 },
    previewCloseTop: { position: 'absolute', top: 48, right: 20, zIndex: 5, width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    previewCloseText: { color: '#172b25', fontSize: 27, lineHeight: 32, fontWeight: '900' },
    fullInvoice: { width: '100%', height: '80%', resizeMode: 'contain' }
  });
}