import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ShoppingCart, MessageCircle, ChevronLeft, Plus, Minus, X, Download, Clock, Store, 
  User, Phone, Users, ScrollText, Edit2, Save, Trash2, LogOut, Eye, EyeOff, Tag, Search, Filter, CheckCircle, ChefHat, FolderOpen, Database, Banknote, QrCode, Image as ImageIcon, UtensilsCrossed, Printer
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAwsfBMS0_9gbPayYU-Ry2iFNfF8TMMKVU",
  authDomain: "tabetai-app-v103.firebaseapp.com",
  projectId: "tabetai-app-v103",
  storageBucket: "tabetai-app-v103.firebasestorage.app",
  messagingSenderId: "555178920953",
  appId: "1:555178920953:web:96ab92b21b8212c57a0b28",
  measurementId: "G-6189BCY5YH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Fungsi Helper Path Firebase
const getColRef = (colName) => {
  let name = colName;
  if (name === 'menu') name = 'menus';
  if (name === 'transactions') name = 'orders';
  return collection(db, name);
};

const getDocRef = (colName, docId) => {
  let name = colName;
  if (name === 'menu') name = 'menus';
  if (name === 'transactions') name = 'orders';
  return doc(db, name, docId);
};

// ==========================================
// CONSTANTS & UTILS
// ==========================================
const ADMIN_CREDENTIALS = { username: 'admin', phone: '2131' };
const ADMIN_WA_NUMBER = "6281285557779"; 
const qrisImageUrl = "https://github.com/gillhardjo/tabetai-app/blob/main/public/qris.png?raw=true";
const logoImageUrl = "https://github.com/gillhardjo/tabetai-app/blob/main/public/logo.png?raw=true";

const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);

const generateInvoiceWAUrl = (order, userPhone) => {
  const itemsText = order.items.map(i => `- ${i.quantity || i.qty}x ${i.name} (${i.variant || i.variantId})${i.note ? ` [Note: ${i.note}]` : ''}: ${formatRp(i.price * (i.quantity || i.qty))}`).join('%0A');
  let discountText = '';
  if (order.discount && order.discount.value > 0) discountText = `%0A*Diskon Promo (${order.discount.code}):* -${formatRp(order.discount.value)}`;
  const text = `*INVOICE TABETAI*%0A%0AOrder ID: ${order.id}%0ATanggal: ${order.date || order.time}%0ANama: ${order.customer}%0A%0A*Detail Pesanan:*%0A${itemsText}%0A%0A*Subtotal:* ${formatRp(order.originalTotal || order.total + (order.discount?.value || 0))}${discountText}%0A*TOTAL TAGIHAN:* ${formatRp(order.total)}%0A%0A*Poin Didapat:* +${order.earnedPoints || 0} Poin%0A%0ATerima kasih telah memesan di Tabetai!`;
  
  let waNumber = userPhone || "";
  waNumber = waNumber.replace(/[^\d+]/g, ''); 
  if (waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1);
  if (waNumber.startsWith('+')) waNumber = waNumber.substring(1);
  return `https://wa.me/${waNumber}?text=${text}`;
};

// ==========================================
// MAIN APP COMPONENT (ROOT)
// ==========================================
export default function TabetaiSuperApp() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  // Realtime Data States
  const [members, setMembers] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [savedBills, setSavedBills] = useState([]);
  
  // Navigation & User State (PERSISTENT LOGIC)
  const [role, setRole] = useState(() => localStorage.getItem('tbt_role') || 'guest'); 
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('tbt_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Save session state locally
  useEffect(() => {
    localStorage.setItem('tbt_role', role);
    if (currentUser) localStorage.setItem('tbt_user', JSON.stringify(currentUser));
    else localStorage.removeItem('tbt_user');
  }, [role, currentUser]);
  
  // Toast Notification
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
        setAuthError(null);
      } catch (error) {
        console.error("Auth Error:", error);
        setAuthError(error.message);
      } finally {
        setIsAuthReady(true);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    
    const unsubMembers = onSnapshot(getColRef('members'), snap => setMembers(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubMenus = onSnapshot(getColRef('menu'), snap => setMenus(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubOrders = onSnapshot(getColRef('transactions'), snap => setOrders(snap.docs.map(d => ({ ...d.data(), dbId: d.id })))); 
    const unsubPromos = onSnapshot(getColRef('promos'), snap => setPromos(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubBills = onSnapshot(getColRef('savedBills'), snap => setSavedBills(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    
    return () => { unsubMembers(); unsubMenus(); unsubOrders(); unsubPromos(); unsubBills(); };
  }, [isAuthReady]);

  const handleLogin = (name, phone) => {
    if (name.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase() && phone === ADMIN_CREDENTIALS.phone) {
      setRole('admin');
      setCurrentUser({ name: 'Admin Tabetai', phone });
      showToast('Berhasil login sebagai Admin', 'success');
      return;
    }
    const existingMember = members.find(m => m.name.toLowerCase() === name.toLowerCase() && m.phone === phone);
    if (existingMember) {
      setRole('member');
      setCurrentUser(existingMember);
      showToast(`Selamat datang kembali, ${existingMember.name}!`, 'success');
      return;
    }
    showToast('Akun tidak ditemukan. Silakan Registrasi.', 'error');
  };

  const handleRegister = async (name, phone) => {
    if(name.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase()) return showToast('Username ini tidak dapat digunakan.', 'error');
    
    // VALIDASI: Mencegah penggunaan nomor WA yang sama
    if(members.find(m => m.phone === phone)) {
      return showToast('Nomor WhatsApp sudah terdaftar. Silakan gunakan nomor lain atau login.', 'error');
    }
    
    try {
      const newMemberData = { name, phone, points: 0, joinedAt: Date.now() };
      const res = await addDoc(getColRef('members'), newMemberData);
      setRole('member');
      setCurrentUser({ ...newMemberData, dbId: res.id });
      showToast('Registrasi berhasil!', 'success');
    } catch (e) {
      showToast("Gagal menyambung ke database.", 'error');
    }
  };

  const handleLogout = () => {
    setRole('guest');
    setCurrentUser(null);
    localStorage.removeItem('tbt_role');
    localStorage.removeItem('tbt_user');
    localStorage.removeItem('tbt_cart_member');
    localStorage.removeItem('tbt_cart_admin');
  };

  const activeUser = currentUser ? members.find(m => m.phone === currentUser.phone && m.name.toLowerCase() === currentUser.name.toLowerCase()) || currentUser : null;

  return (
    <div className="w-full min-h-screen bg-slate-100 font-sans flex justify-center overflow-hidden relative">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white font-bold shadow-xl z-[999] flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'}`}>
          {toast.type === 'success' && <CheckCircle size={20} />}
          {toast.message}
        </div>
      )}
      {authError && <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center text-xs py-1 z-[1000]">Error Firebase: {authError}</div>}

      {role === 'guest' && <GuestView onLogin={handleLogin} onRegister={handleRegister} />}
      {role === 'member' && <MemberAppView user={activeUser} menus={menus} orders={orders} promos={promos} onLogout={handleLogout} showToast={showToast} />}
      {role === 'admin' && <AdminPOSView menus={menus} orders={orders} members={members} promos={promos} savedBills={savedBills} onLogout={handleLogout} showToast={showToast} />}
    </div>
  );
}


// ==========================================
// 1. GUEST VIEW (Login & Register)
// ==========================================
function GuestView({ onLogin, onRegister }) {
  const [view, setView] = useState('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const onSubmit = (e) => {
    e.preventDefault();
    if (view === 'login') onLogin(name, phone);
    else onRegister(name, phone);
  };

  return (
    <div className="w-full max-w-md bg-red-50 min-h-screen flex flex-col justify-center px-8 shadow-2xl">
      <div className="text-center mb-10 animate-fade-in-up">
        <div className="w-32 h-32 mx-auto mb-4 shadow-xl rounded-full overflow-hidden bg-white border-4 border-white flex items-center justify-center">
          <img src={logoImageUrl} alt="Tabetai Logo" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://placehold.co/200x200/ef4444/ffffff?text=Tabetai'; }} />
        </div>
        <h1 className="text-3xl font-black text-red-600 tracking-tight mt-2">TABETAI.ID</h1>
        <p className="text-red-900/60 font-medium mt-1 text-sm">Oishii Onigiri</p>
      </div>
      
      <div className="bg-white p-6 rounded-3xl shadow-lg shadow-red-100/50 border border-red-50 animate-in slide-in-from-bottom-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">{view === 'login' ? 'Masuk ke Akun' : 'Daftar Member Baru'}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Lengkap / Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={18} />
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Budi Santoso" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">No. WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contoh: 08123456789" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
            </div>
          </div>
          <button type="submit" className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-all mt-4">
            {view === 'login' ? 'Login' : 'Daftar Sekarang'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          <p className="text-slate-500">{view === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}</p>
          <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="text-red-600 font-bold mt-1 hover:underline">
            {view === 'login' ? 'Registrasi Member Baru' : 'Login di sini'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// 2. MEMBER APP VIEW (Customer)
// ==========================================
function MemberAppView({ user, menus, orders, promos, onLogout, showToast }) {
  const [view, setView] = useState('home'); 
  
  // Persistent Cart for Members
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('tbt_cart_member');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('tbt_cart_member', JSON.stringify(cart)); }, [cart]);
  
  const [selectedItem, setSelectedItem] = useState(null);

  const getCartTotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const getCartCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (item, variantName, quantity, note) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.id === item.id && i.variant === variantName && i.note === note);
      if (existing > -1) {
        const newCart = [...prev];
        newCart[existing].quantity += quantity;
        return newCart;
      }
      return [...prev, { ...item, variant: variantName, quantity, note, cartId: Date.now() }];
    });
    setSelectedItem(null);
    showToast("Berhasil ditambah ke keranjang");
  };

  const placeOrder = async (finalTotal, discountObj) => {
    const earnedPoints = Math.floor(finalTotal * 0.1); 
    
    let maxId = 0;
    orders.forEach(o => {
      const match = o.id && o.id.match(/APP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });
    const orderId = `APP-${String(maxId + 1).padStart(4, '0')}`;
    const dateObj = new Date();
    const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    
    const newOrderData = {
      id: orderId,
      customer: user.name,
      customerPhone: user.phone,
      items: [...cart],
      total: finalTotal,
      originalTotal: getCartTotal(),
      discount: discountObj || null,
      earnedPoints: earnedPoints,
      isPointsAwarded: false,
      isStockDeducted: false,
      status: 'Menunggu Pembayaran',
      payment: 'QRIS / Transfer',
      time: timeStr,
      date: dateObj.toLocaleString('id-ID'),
      filterDateKey: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`,
      timestamp: Date.now()
    };
    
    try {
      await setDoc(getDocRef('transactions', orderId), newOrderData);

      // --- POTONG STOK PROMO & CATAT PENGGUNAAN ---
      if (discountObj && discountObj.dbId) {
        const promoToUpdate = promos.find(p => p.dbId === discountObj.dbId);
        if (promoToUpdate) {
          await updateDoc(getDocRef('promos', promoToUpdate.dbId), {
            stock: Math.max(0, (promoToUpdate.stock || 0) - 1),
            usedBy: [...(promoToUpdate.usedBy || []), user.phone] // Catat no HP member
          });
        }
      }

      setCart([]);
      setView('payment');
      showToast("Pesanan berhasil dibuat!", "success");
    } catch (e) {
      showToast("Gagal memproses pesanan.", "error");
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) {
      try {
        await updateDoc(getDocRef('transactions', orderId), { status: 'Dibatalkan' });
        
        // --- KEMBALIKAN STOK PROMO JIKA DIBATALKAN ---
        const target = orders.find(o => o.dbId === orderId);
        if (target && target.discount && target.discount.dbId) {
          const promoToUpdate = promos.find(p => p.dbId === target.discount.dbId);
          if (promoToUpdate) {
            const updatedUsedBy = (promoToUpdate.usedBy || []).filter(phone => phone !== target.customerPhone);
            await updateDoc(getDocRef('promos', promoToUpdate.dbId), {
              stock: (promoToUpdate.stock || 0) + 1,
              usedBy: updatedUsedBy
            });
          }
        }
        
        showToast("Pesanan berhasil dibatalkan", "info");
      } catch (e) {
        showToast("Gagal membatalkan pesanan", "error");
      }
    }
  };

  const activeMenus = menus.filter(m => m.isActive !== false).sort((a,b) => (a.orderPriority || 99) - (b.orderPriority || 99));
  
  // Sort user orders purely by timestamp descending for History
  const myOrders = orders.filter(o => o.customer === user.name && o.customerPhone === user.phone).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));

  return (
    <div className="w-full max-w-md bg-slate-50 min-h-screen relative shadow-2xl flex flex-col overflow-hidden">
      {view === 'home' && (
        <div className="flex-1 flex flex-col">
          <div className="bg-red-600 pt-12 pb-24 px-6 rounded-b-[40px] text-white shadow-md relative z-10 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mt-1 truncate">{user?.name}-san, Irasshaimase!</h1>
              <p className="text-red-100 text-sm font-medium">Kyou, nani tabetai?</p>
              <div className="mt-3 inline-flex items-center gap-1.5 bg-red-700/80 px-4 py-1.5 rounded-full text-sm font-bold shadow-inner border border-red-500/50">
                <Tag size={14} className="text-yellow-400" /> {user?.points || 0} Poin Tersedia
              </div>
            </div>
            <button onClick={onLogout} className="bg-red-700 p-2.5 rounded-full hover:bg-red-800 transition-colors shadow-sm"><LogOut size={20} /></button>
          </div>
          <div className="flex-1 px-6 -mt-16 z-20 relative space-y-4">
            <button onClick={() => setView('menu')} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow active:scale-[0.98] text-left">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-3xl">🍱</div>
                <div><h2 className="text-lg font-bold text-slate-800">Menu Tabetai</h2><p className="text-sm text-slate-500 mt-1">Pesan makanan & minuman</p></div>
              </div>
              <ChevronLeft className="text-slate-300 rotate-180" />
            </button>
            <button onClick={() => setView('status')} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow active:scale-[0.98] text-left">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><Clock size={32} /></div>
                <div><h2 className="text-lg font-bold text-slate-800">Status Pesanan</h2><p className="text-sm text-slate-500 mt-1">Cek pesanan aktif & riwayat</p></div>
              </div>
              <ChevronLeft className="text-slate-300 rotate-180" />
            </button>
          </div>
          <a href={`https://wa.me/${ADMIN_WA_NUMBER}?text=Halo%20Admin%20Tabetai,%20saya%20${user.name}%20butuh%20bantuan.`} target="_blank" rel="noreferrer" className="absolute bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-transform active:scale-95 z-50">
            <MessageCircle size={28} />
          </a>
        </div>
      )}

      {view === 'menu' && (
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm border-b border-slate-50">
            <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={24} className="text-slate-700" /></button>
            <h1 className="flex-1 text-center font-bold text-lg text-slate-800 pr-10">Daftar Menu</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
            {activeMenus.map(item => (
              <div key={item.dbId} className="flex gap-4 p-4 border border-slate-100 rounded-2xl shadow-sm bg-white">
                <div className="w-24 h-24 bg-slate-50 rounded-xl overflow-hidden shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="font-bold text-slate-800">{item.name}</h3>
                  {item.desc && <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{item.desc}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="font-bold text-red-600">{formatRp(item.price)}</span>
                    <button onClick={() => setSelectedItem(item)} className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full font-semibold text-sm hover:bg-red-100">Tambah</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {getCartCount() > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-30">
              <div onClick={() => setView('checkout')} className="bg-red-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer active:scale-[0.98]">
                <div className="flex flex-col"><span className="text-sm text-red-100 font-medium">{getCartCount()} Item</span><span className="font-bold text-lg">{formatRp(getCartTotal())}</span></div>
                <div className="flex items-center gap-2 font-bold bg-red-700 py-2 px-4 rounded-xl"><ShoppingCart size={18} /> Checkout</div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'checkout' && (
        <MemberCheckout cart={cart} onBack={() => setView('menu')} updateQty={(id, d) => setCart(c => c.map(i => i.cartId === id ? {...i, quantity: Math.max(0, i.quantity + d)} : i).filter(i => i.quantity > 0))} subtotal={getCartTotal()} onPay={placeOrder} promos={promos} formatRp={formatRp} showToast={showToast} userPhone={user.phone} />
      )}

      {view === 'payment' && myOrders[0] && (
        <MemberPayment order={myOrders[0]} userPhone={user.phone} onCheckStatus={() => setView('status')} onBackHome={() => setView('home')} formatRp={formatRp} />
      )}

      {view === 'status' && (
        <MemberStatus orders={myOrders} onBack={() => setView('home')} userPhone={user.phone} formatRp={formatRp} onCancelOrder={handleCancelOrder} />
      )}

      {selectedItem && (
        <VariantModal item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={addToCart} formatRp={formatRp} />
      )}
    </div>
  );
}

function MemberCheckout({ cart, onBack, updateQty, subtotal, onPay, promos, formatRp, showToast, userPhone }) {
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);

  const applyPromo = () => {
    const valid = promos.find(p => p.code === promoCode.toUpperCase() && p.isActive !== false);
    if (!valid) return showToast('Kode promo tidak valid', 'error');
    if (valid.stock !== undefined && valid.stock <= 0) return showToast('Kuota promo sudah habis', 'error');
    if (valid.usedBy && valid.usedBy.includes(userPhone)) return showToast('Anda sudah pernah menggunakan kode promo ini', 'error');
    
    setAppliedPromo(valid); 
    showToast(`Promo ${valid.code} diterapkan!`); 
  };

  const discountAmount = appliedPromo ? (appliedPromo.type === 'percent' ? Math.floor(subtotal * (appliedPromo.value / 100)) : appliedPromo.value) : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm"><button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={24} /></button><h1 className="flex-1 text-center font-bold text-lg">Konfirmasi Pesanan</h1></div>
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50"><h2 className="font-bold text-slate-800 text-sm">Daftar Pesanan</h2></div>
          <div className="divide-y divide-slate-50">
            {cart.map(item => (
              <div key={item.cartId} className="p-4 flex gap-4">
                <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Varian: {item.variant}</p>
                  {item.note && <p className="text-xs text-slate-400 italic">Catatan: {item.note}</p>}
                  <p className="font-bold text-red-600 text-sm mt-1">{formatRp(item.price)}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                    <button onClick={() => updateQty(item.cartId, -1)} className="w-7 h-7 bg-white rounded flex items-center justify-center text-slate-600 shadow-sm"><Minus size={14} /></button>
                    <span className="font-semibold text-sm w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.cartId, 1)} className="w-7 h-7 bg-white rounded flex items-center justify-center text-red-600 shadow-sm"><Plus size={14} /></button>
                  </div>
                  <span className="text-xs font-bold text-slate-800 mt-2">{formatRp(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Kode Promo / Voucher</h2>
          <div className="flex gap-2">
            <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Masukkan kode promo" className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 outline-none uppercase text-sm" />
            <button onClick={applyPromo} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-800">Pakai</button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Ringkasan Pembayaran</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatRp(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Diskon Promo ({appliedPromo.code})</span><span>-{formatRp(discountAmount)}</span></div>}
          </div>
          <div className="border-t border-dashed border-slate-200 mt-3 pt-3 flex justify-between items-center"><span className="font-bold text-slate-800">Total Akhir</span><span className="font-black text-red-600 text-lg">{formatRp(finalTotal)}</span></div>
          <div className="bg-red-50 text-red-700 text-xs text-center p-2 rounded-lg mt-4 font-medium">Dapatkan <strong className="text-red-800">{Math.floor(finalTotal * 0.1)} Poin</strong> dari pesanan ini!</div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]"><button onClick={() => onPay(finalTotal, appliedPromo ? { code: appliedPromo.code, value: discountAmount, dbId: appliedPromo.dbId } : null)} className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 flex justify-center gap-2">Lanjut Pembayaran</button></div>
    </div>
  );
}

function MemberPayment({ onCheckStatus, onBackHome, order, userPhone, formatRp }) {
  const handleConfirmWA = () => {
    let waNumber = ADMIN_WA_NUMBER.replace(/[^\d+]/g, ''); 
    const text = `Halo Admin Tabetai, saya ${order.customer} sudah melakukan pembayaran via QRIS untuk Order ID: ${order.id} sebesar *${formatRp(order.total)}*. Mohon dicek ya!`;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-4 bg-white flex items-center border-b border-slate-100"><h1 className="flex-1 text-center font-bold text-lg">Pembayaran</h1></div>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <p className="text-slate-500 text-sm mb-1">Total Tagihan</p><p className="text-3xl font-black text-slate-800 mb-8">{formatRp(order.total)}</p>
        <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100 mb-6 w-full max-w-[260px] relative">
          <img src={qrisImageUrl} alt="QRIS" className="w-full object-contain" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-xs font-bold">QRIS TABETAI</div>
        </div>
        <button onClick={() => window.open(generateInvoiceWAUrl(order, userPhone), '_blank')} className="text-blue-600 font-semibold bg-blue-50 py-3 px-6 rounded-xl text-sm mb-10 flex gap-2"><ScrollText size={16} /> Download Invoice</button>
        <div className="w-full mt-auto space-y-3">
          <button onClick={handleConfirmWA} className="w-full bg-green-500 text-white font-bold py-4 rounded-xl flex justify-center gap-2"><MessageCircle size={20} /> Konfirmasi pesanan via WA</button>
          <button onClick={onCheckStatus} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl">Cek Status Pesanan</button>
          <button onClick={onBackHome} className="w-full bg-slate-100 text-slate-800 font-bold py-4 rounded-xl mt-2">Kembali ke Beranda</button>
        </div>
      </div>
    </div>
  );
}

function MemberStatus({ orders, onBack, userPhone, formatRp, onCancelOrder }) {
  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative pb-24">
      <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100"><button onClick={onBack} className="p-2"><ChevronLeft size={24} /></button><h1 className="flex-1 text-center font-bold text-lg pr-10">Riwayat Pesanan</h1></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {orders.map((order) => (
          <div key={order.dbId} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${order.status === 'Selesai' ? 'bg-green-500' : order.status === 'Diproses' ? 'bg-blue-500' : order.status === 'Dibatalkan' ? 'bg-red-500' : 'bg-orange-500'}`} />
            <div className="flex justify-between items-start mb-3">
              <div><p className="text-xs text-slate-500 mb-0.5">{order.time} {order.date && `• ${order.date.split(',')[0]}`}</p><p className="font-bold text-slate-800 text-sm">ID: {order.id}</p></div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${order.status === 'Selesai' ? 'bg-green-100 text-green-700' : order.status === 'Diproses' ? 'bg-blue-100 text-blue-700' : order.status === 'Dibatalkan' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{order.status}</span>
            </div>
            <div className="border-t border-b border-slate-50 py-3 my-3 text-sm text-slate-600 space-y-1">
              {order.items.map((item, i) => <div key={i}><span className="font-semibold text-slate-800">{(item.quantity || item.qty)}x {item.name}</span></div>)}
            </div>
            <div className="flex justify-between items-center mb-4"><span className="text-sm text-slate-500">Total</span><span className="font-bold text-slate-800">{formatRp(order.total)}</span></div>
            <button onClick={() => window.open(generateInvoiceWAUrl(order, userPhone), '_blank')} className="w-full flex justify-center gap-2 text-blue-600 font-semibold border border-blue-100 bg-blue-50 py-2 rounded-lg text-sm"><Download size={14} /> Invoice WA</button>
            {(order.status === 'Menunggu Pembayaran' || order.status === 'Pending') && (
               <button onClick={() => onCancelOrder(order.dbId)} className="w-full mt-2 flex justify-center gap-2 text-red-600 font-semibold border border-red-100 bg-red-50 py-2 rounded-lg text-sm transition-colors hover:bg-red-100"><X size={14} /> Batalkan Pesanan</button>
            )}
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100"><button onClick={onBack} className="w-full bg-slate-100 text-slate-800 font-bold py-4 rounded-xl">Kembali ke Beranda</button></div>
    </div>
  );
}

function VariantModal({ item, onClose, onAdd, formatRp }) {
  const availableVariants = item.variants?.filter(v => v.qty > 0) || [];
  const [selectedVariant, setSelectedVariant] = useState(availableVariants[0]?.name || (item.variants?.[0]?.name) || '');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full overflow-hidden">
        
        {/* HERO IMAGE BESAR */}
        <div className="relative w-full h-56 md:h-64 bg-slate-100 shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md text-white rounded-full z-10 hover:bg-black/60 transition-colors"><X size={20} /></button>
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        </div>
        
        {/* INFO JUDUL & DESKRIPSI */}
        <div className="p-6 border-b border-slate-100 shrink-0 bg-white z-10">
          <h2 className="font-bold text-2xl text-slate-800">{item.name}</h2>
          {item.desc && <p className="text-sm text-slate-500 mt-2 leading-relaxed">{item.desc}</p>}
          <p className="text-red-600 font-black text-xl mt-2">{formatRp(item.price)}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white z-10">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">Pilih Varian</h3>
          <div className="space-y-2 mb-6">
            {item.variants?.map(v => (
              <label key={v.name} className={`flex items-center justify-between p-4 border rounded-xl ${selectedVariant === v.name ? 'border-red-500 bg-red-50/50' : 'border-slate-200'}`}>
                <span className="font-medium text-slate-700">{v.name} {v.qty === 0 && '(Habis)'}</span>
                {v.qty > 0 && <input type="radio" checked={selectedVariant === v.name} onChange={() => setSelectedVariant(v.name)} className="w-5 h-5 accent-red-500" />}
              </label>
            ))}
          </div>
          <h3 className="font-bold text-slate-800 mb-3 text-sm">Catatan Tambahan</h3>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: pedas sekali..." className="w-full p-4 border border-slate-200 rounded-xl focus:border-red-500 outline-none text-sm resize-none" rows="2" />
        </div>
        <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-4 pb-8">
          <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-xl">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 bg-white rounded-lg shadow-sm"><Minus size={18} className="mx-auto"/></button>
            <span className="font-bold text-lg w-4 text-center">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="w-10 h-10 bg-white rounded-lg shadow-sm text-red-600"><Plus size={18} className="mx-auto"/></button>
          </div>
          <button onClick={() => onAdd(item, selectedVariant, qty, note)} disabled={!selectedVariant} className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 disabled:opacity-50">Tambah - {formatRp(item.price * qty)}</button>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// 3. ADMIN POS VIEW
// ==========================================
function AdminPOSView({ menus, orders, members, promos, savedBills, onLogout, showToast }) {
  const [activeTab, setActiveTab] = useState('kasir'); 
  
  // Persistent Cart for Admin
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('tbt_cart_admin');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('tbt_cart_admin', JSON.stringify(cart)); }, [cart]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState(null);

  const [checkoutModal, setCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(''); 
  const [cashAmount, setCashAmount] = useState('');
  const [variantModal, setVariantModal] = useState(false);
  const [showSaveBillModal, setShowSaveBillModal] = useState(false);
  const [billName, setBillName] = useState("");

  const pendingCount = orders.filter(o => o.status === 'Menunggu Pembayaran' || o.status === 'Pending').length;
  
  // NOTIFICATION SOUND LOGIC
  const prevPendingCount = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount > prevPendingCount.current) {
      try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        let playCount = 0;
        const maxPlays = 5;

        audio.onended = () => {
          playCount++;
          if (playCount < maxPlays) {
            audio.play().catch(e => console.log('Audio autoplay blocked by browser', e));
          }
        };

        audio.play().catch(e => console.log('Audio autoplay blocked by browser', e));
      } catch (e) {}
    }
    prevPendingCount.current = pendingCount;
  }, [pendingCount]);

  const filteredMenu = menus.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch && item.isActive !== false;
  }).sort((a, b) => (a.orderPriority || 99) - (b.orderPriority || 99));

  const addToCartFinal = (item, variantName, quantity = 1, note = '') => {
    const itemPrice = item.price; 
    const variantId = variantName || 'default';

    const existing = cart.findIndex(c => c.originalId === (item.dbId || item.id) && c.variantId === variantId && c.note === note);
    if (existing > -1) {
      const newCart = [...cart]; newCart[existing].qty += quantity; setCart(newCart);
    } else {
      setCart([...cart, { ...item, name: item.name, price: itemPrice, qty: quantity, variantId, originalId: (item.dbId || item.id), note }]);
    }
    setVariantModal(false);
  };

  const applyPromoCode = () => {
    const valid = promos.find(p => p.code === promoCode.toUpperCase() && p.isActive !== false);
    if (valid) {
      if (valid.stock !== undefined && valid.stock <= 0) {
        setDiscount(0); setAppliedPromo(null); return showToast("Kuota promo sudah habis", "error");
      }
      const sub = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      setDiscount(valid.type === 'percent' ? sub * (valid.value / 100) : valid.value);
      setAppliedPromo(valid);
      showToast(`Promo ${valid.code} diterapkan!`, "success");
    } else {
      setDiscount(0); setAppliedPromo(null); showToast("Kode promo tidak valid", "error");
    }
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const calculateTotal = () => Math.max(0, calculateSubtotal() - discount);
  const calculateChange = () => cashAmount ? parseInt(cashAmount.replace(/\D/g, '')) - calculateTotal() : 0;

  const handleCheckout = async () => {
    if (!paymentMethod) return showToast("Pilih metode pembayaran!", "error");
    if (paymentMethod === 'Cash' && calculateChange() < 0) return showToast("Uang tunai kurang!", "error");

    let maxId = 0;
    orders.forEach(o => {
      const match = o.id && o.id.match(/-(0*\d+)$/);
      if (match && o.id.startsWith('POS-')) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });
    const id = `POS-${String(maxId + 1).padStart(4, '0')}`;
    
    // Format Waktu Konsisten: HH:MM
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    const newTrx = {
      id, customer: 'Walk-in / Cashier', items: [...cart], 
      total: calculateTotal(),
      originalTotal: calculateSubtotal(),
      discount: appliedPromo ? { code: appliedPromo.code, value: discount, dbId: appliedPromo.dbId } : null,
      status: "Diproses", payment: paymentMethod, 
      isStockDeducted: true,
      time: timeStr,
      date: new Date().toLocaleString('id-ID'), timestamp: Date.now()
    };
    try {
      await setDoc(getDocRef('transactions', id), newTrx);
      
      // --- POTONG STOK PROMO JIKA DIGUNAKAN DI KASIR ---
      if (appliedPromo && appliedPromo.dbId) {
        const promoToUpdate = promos.find(p => p.dbId === appliedPromo.dbId);
        if (promoToUpdate) {
          await updateDoc(getDocRef('promos', promoToUpdate.dbId), {
            stock: Math.max(0, (promoToUpdate.stock || 0) - 1)
          });
        }
      }

      // Memotong stok otomatis dan Auto-Hide jika 0
      for (const item of cart) {
        const menuTarget = menus.find(m => m.dbId === (item.originalId || item.dbId || item.id));
        if (menuTarget) {
          const deductQty = Number(item.qty || item.quantity || 1);
          const variantName = item.variantId || item.variant || 'default';
          
          const updatedVariants = menuTarget.variants.map(v => 
            v.name === variantName ? { ...v, qty: Math.max(0, Number(v.qty) - deductQty) } : v
          );
          
          const totalQty = updatedVariants.reduce((sum, v) => sum + (Number(v.qty) || 0), 0);
          const updates = { variants: updatedVariants };
          if (totalQty <= 0) updates.isActive = false; // Auto Hide
          
          await updateDoc(getDocRef('menu', menuTarget.dbId), updates);
        }
      }

      setCart([]); setPromoCode(""); setDiscount(0); setAppliedPromo(null); setPaymentMethod(''); setCashAmount(''); setCheckoutModal(false);
      showToast("Pembayaran Berhasil! Struk siap dicetak.", "success");
    } catch (e) { showToast("Gagal memproses pembayaran", "error"); }
  };

  const handleSaveBill = async () => {
    if (cart.length === 0 || !billName) return showToast("Keranjang kosong / Nama belum diisi", "error");
    try {
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
      await setDoc(getDocRef('savedBills', `BILL-${Date.now()}`), { name: billName, items: [...cart], timeString: timeStr, timestamp: Date.now() });
      setCart([]); setShowSaveBillModal(false); setBillName(""); showToast(`Bill '${billName}' disimpan`, "success");
    } catch (e) { showToast("Gagal menyimpan bill", "error"); }
  };

  const handlePrintReceipt = async (order) => {
    if (!navigator.bluetooth) {
      return showToast("Browser/Perangkat ini tidak mendukung Bluetooth Web API", "error");
    }
    try {
      showToast("Mencari Printer Bluetooth...", "info");
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000180a-0000-1000-8000-00805f9b34fb'] 
      });
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let printChar = null;
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) { printChar = char; break; }
        }
        if (printChar) break;
      }

      if (!printChar) throw new Error("Tidak menemukan jalur tulis di printer ini.");

      const ESC = '\x1B';
      const init = ESC + '@';
      const center = ESC + 'a' + '\x01';
      const left = ESC + 'a' + '\x00';
      const boldOn = ESC + 'E' + '\x01';
      const boldOff = ESC + 'E' + '\x00';
      
      const lineWidth = 28;
      const lineStr = '-'.repeat(lineWidth) + '\n';
      const dotLineStr = '.'.repeat(lineWidth) + '\n';
      
      const alignRight = (leftText, rightText) => {
        let l = String(leftText); let r = String(rightText);
        let spaces = lineWidth - l.length - r.length;
        if (spaces < 1) return l + ' ' + r + '\n';
        return l + ' '.repeat(spaces) + r + '\n';
      };

      // --- FILTER WAKTU (DD/MM/YY HH:MM) ---
      let formattedDateTime = '';
      if (order.timestamp) {
        const d = new Date(order.timestamp);
        const DD = String(d.getDate()).padStart(2, '0');
        const MM = String(d.getMonth() + 1).padStart(2, '0');
        const YY = String(d.getFullYear()).slice(-2);
        const HH = String(d.getHours()).padStart(2, '0');
        const MIN = String(d.getMinutes()).padStart(2, '0');
        formattedDateTime = `${DD}/${MM}/${YY} ${HH}:${MIN}`;
      } else {
        let timeStr = order.time ? order.time.replace('.', ':').substring(0, 5) : '';
        let dateStr = order.date ? order.date.split(',')[0].trim() : '';
        const parts = dateStr.split('/');
        if (parts.length === 3) dateStr = `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2].slice(-2)}`;
        formattedDateTime = `${dateStr} ${timeStr}`.trim();
      }
      
      let receiptText = init + center + boldOn + 'tabetai.id\n' + boldOff;
      receiptText += 'oishii onigiri\n\n';
      receiptText += left + `Order: ${order.customer}\n`;
      receiptText += `No. Resi: ${order.id}\n`;
      receiptText += `Employee: Admin\n`;
      receiptText += `POS: Master\n`;
      receiptText += lineStr;
      
      order.items.forEach(item => {
        const qty = item.quantity || item.qty;
        let displayName = item.name.length > 15 ? item.name.substring(0, 14) + '.' : item.name;
        
        if (item.note) {
          receiptText += `${displayName}\n`;
          receiptText += `  Catatan: ${item.note}\n`;
          receiptText += alignRight(`${qty} x ${formatRp(item.price)}`, formatRp(item.price * qty));
        } else {
          receiptText += alignRight(displayName, formatRp(item.price * qty));
          receiptText += `${qty} x ${formatRp(item.price)}\n`;
        }
        
        const variant = item.variant || item.variantId;
        if (variant && variant !== 'default') {
          variant.split(',').forEach(v => {
            receiptText += `  + ${v.trim()}\n`;
          });
        }
        receiptText += ' \n'; 
      });
      
      receiptText += lineStr;
      
      if (order.discount && order.discount.value > 0) {
        receiptText += alignRight('Subtotal', formatRp((order.originalTotal || order.total) + order.discount.value));
        receiptText += alignRight(`Diskon`, '-' + formatRp(order.discount.value));
        receiptText += lineStr;
      }

      let totalLine = alignRight('Total', formatRp(order.total));
      receiptText += boldOn + totalLine.replace('\n', '') + boldOff + '\n\n';
      
      receiptText += alignRight(order.payment || 'QRIS', formatRp(order.total));
      receiptText += dotLineStr;
      
      receiptText += center + '**Arigatou**\n';
      receiptText += 'Please consume it\n';
      receiptText += 'immediately on the day\n';
      receiptText += 'it is ordered or store it\n';
      receiptText += 'in the refrigerator for\n';
      receiptText += 'a maximum of 3 days\n\n';
      
      receiptText += 'WA : 0812-8555-7779\n';
      receiptText += '(text only)\n';
      receiptText += 'IG : @tabetaii.id\n\n';

      const shortId = '#' + (order.id.split('-')[1] || order.id);
      receiptText += left + alignRight(formattedDateTime, shortId);
      receiptText += '\n\n\n\n';

      const encoder = new TextEncoder();
      const printData = encoder.encode(receiptText);
      const chunkSize = 256;
      for (let i = 0; i < printData.length; i += chunkSize) {
        await printChar.writeValue(printData.slice(i, i + chunkSize));
      }
      showToast("Struk berhasil dicetak!", "success");
    } catch (error) {
      console.error(error);
      if (error.name === 'SecurityError' || error.message.includes('permissions policy')) {
        showToast("Bluetooth diblokir di layar Preview. Buka aplikasi di tab baru atau deploy ke Vercel.", "error");
      } else {
        showToast(error.message.includes('cancelled') ? 'Pencetakan dibatalkan' : 'Gagal mencetak: ' + error.message, "error");
      }
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden w-full">
      <div className="w-24 md:w-64 bg-white shadow-xl flex flex-col justify-between z-10">
        <div>
          <div className="p-4 md:p-6 flex items-center justify-center md:justify-start gap-3 border-b border-slate-100">
            <img src={logoImageUrl} alt="Tabetai Logo" className="w-10 h-10 bg-red-600 rounded-xl p-1" />
            <h1 className="text-xl font-black text-slate-800 hidden md:block">Tabetai<span className="text-red-600">POS</span></h1>
          </div>
          <nav className="p-4 space-y-2">
            {[{id:'kasir', icon: ChefHat, label: 'Kasir'}, {id:'pesanan', icon: Clock, label: 'Pesanan'}, {id:'openbill', icon: FolderOpen, label: 'Open Bill'}, {id:'menu', icon: UtensilsCrossed, label: 'Menu Admin'}, {id:'members', icon: Users, label: 'Member'}, {id:'promos', icon: Tag, label: 'Promo'}].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative w-full flex items-center gap-3 px-3 py-3 md:px-4 rounded-xl transition-colors ${activeTab === tab.id ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-red-50'}`}>
                <tab.icon size={22} className="mx-auto md:mx-0"/>
                <span className="font-bold hidden md:block">{tab.label}</span>
                {tab.id === 'openbill' && savedBills.length > 0 && <span className="absolute top-2 right-2 md:static md:ml-auto bg-yellow-400 text-black text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-bold">{savedBills.length}</span>}
                {tab.id === 'pesanan' && pendingCount > 0 && <span className="absolute top-2 right-2 md:static md:ml-auto bg-blue-500 text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-bold shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse">{pendingCount} Baru</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center gap-3">
          <button onClick={onLogout} className="p-2 bg-slate-100 text-red-600 rounded-full hover:bg-red-100"><LogOut size={18}/></button>
          <div className="hidden md:block">
            <p className="text-xs font-semibold text-green-500">Online</p>
            <p className="text-sm font-bold text-slate-700">Admin Mode</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'kasir' && (
          <div className="flex-1 flex overflow-hidden bg-slate-50">
            <div className="flex-[2] flex flex-col h-full border-r border-slate-200">
              <div className="p-4 bg-white z-10 flex flex-col gap-4 shadow-sm">
                <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Cari nama menu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-200 outline-none" /></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                {filteredMenu.map(item => (
                  <div key={item.dbId} onClick={() => item.variants?.length ? setVariantModal(item) : addToCartFinal(item, null)} className="bg-white rounded-2xl p-3 border border-slate-100 hover:border-red-300 hover:shadow-lg cursor-pointer flex flex-col h-fit">
                    <div className="w-full aspect-square bg-slate-100 rounded-xl mb-3 overflow-hidden relative"><img src={item.image} className="w-full h-full object-cover" /></div>
                    <h3 className="font-bold text-sm mb-1 line-clamp-2">{item.name}</h3>
                    <p className="text-red-600 font-black text-sm mt-1">{formatRp(item.price)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-[350px] lg:w-[400px] bg-white flex flex-col h-full">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold">Pesanan <span className="bg-red-100 text-red-600 text-sm py-0.5 px-2 rounded-full">{cart.reduce((a,c)=>a+c.qty,0)}</span></h2>{cart.length>0 && <button onClick={()=>setCart([])} className="text-red-500 text-sm font-semibold">Kosongkan</button>}</div>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    <img src={item.image} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{item.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Varian: {item.variantId}</p>
                      {item.note && <p className="text-xs text-slate-400 italic">"{item.note}"</p>}
                      <p className="text-red-500 font-bold text-xs mt-1">{formatRp(item.price * item.qty)}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                      <button onClick={() => setCart(c => c.map(i=> i.originalId===item.originalId && i.variantId===item.variantId && i.note===item.note ? {...i, qty: i.qty-1} : i).filter(i=>i.qty>0))} className="w-7 h-7 bg-white rounded flex items-center justify-center shadow-sm"><Minus size={14}/></button>
                      <span className="w-4 text-center font-bold text-sm">{item.qty}</span>
                      <button onClick={() => setCart(c => c.map(i=> i.originalId===item.originalId && i.variantId===item.variantId && i.note===item.note ? {...i, qty: i.qty+1} : i))} className="w-7 h-7 bg-white rounded flex items-center justify-center text-red-600 shadow-sm"><Plus size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
                <div className="flex gap-2 mb-4"><input type="text" placeholder="Promo" value={promoCode} onChange={(e)=>setPromoCode(e.target.value.toUpperCase())} className="flex-1 px-3 py-2 bg-slate-50 border rounded-xl text-sm outline-none uppercase" /><button onClick={applyPromoCode} className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-xl">Pakai</button></div>
                <div className="flex justify-between items-center mb-1"><span className="text-slate-500 text-sm">Subtotal</span><span className="font-semibold text-slate-700">{formatRp(calculateSubtotal())}</span></div>
                {discount > 0 && <div className="flex justify-between items-center mb-1 text-green-600"><span className="text-sm">Diskon Promo ({appliedPromo?.code})</span><span className="font-semibold">-{formatRp(discount)}</span></div>}
                <div className="flex justify-between items-center mb-3 pt-2 border-t border-slate-100"><span className="text-slate-800 font-bold">Total Akhir</span><span className="text-2xl font-black text-red-600">{formatRp(calculateTotal())}</span></div>
                <div className="flex gap-2">
                  <button onClick={() => { if (cart.length > 0) setShowSaveBillModal(true); }} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold"><FolderOpen size={24} /></button>
                  <button onClick={() => { if (cart.length > 0) setCheckoutModal(true); }} className="flex-1 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200">Pilih Pembayaran</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pesanan' && <AdminOrderManager orders={orders} members={members} menus={menus} promos={promos} db={db} formatRp={formatRp} showToast={showToast} onPrint={handlePrintReceipt} />}
        {activeTab === 'openbill' && <AdminOpenBill savedBills={savedBills} db={db} handleLoadBill={(b) => { setCart(b.items); setActiveTab('kasir'); deleteDoc(getDocRef('savedBills', b.dbId)); }} />}
        {activeTab === 'menu' && <AdminMenuManager menus={menus} db={db} formatRp={formatRp} showToast={showToast} />}
        {activeTab === 'members' && <AdminMemberManager members={members} db={db} showToast={showToast} />}
        {activeTab === 'promos' && <AdminPromoManager promos={promos} db={db} formatRp={formatRp} showToast={showToast} />}

        {checkoutModal && (
          <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50"><h3 className="font-black text-xl">Pembayaran</h3><button onClick={()=>setCheckoutModal(false)}><X size={20}/></button></div>
              <div className="p-6 text-center"><p className="text-sm text-slate-500 mb-1">Total</p><p className="text-4xl font-black text-red-600 mb-6">{formatRp(calculateTotal())}</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => setPaymentMethod('Cash')} className={`py-4 rounded-2xl font-bold border-2 flex flex-col items-center gap-2 ${paymentMethod==='Cash'?'border-red-500 bg-red-50 text-red-700':'border-slate-200 text-slate-500'}`}><Banknote size={28} /> Tunai</button>
                  <button onClick={() => setPaymentMethod('QRIS')} className={`py-4 rounded-2xl font-bold border-2 flex flex-col items-center gap-2 ${paymentMethod==='QRIS'?'border-red-500 bg-red-50 text-red-700':'border-slate-200 text-slate-500'}`}><QrCode size={28} /> QRIS</button>
                </div>
                {paymentMethod === 'Cash' && (
                  <input type="text" value={cashAmount} onChange={(e) => { const v=e.target.value.replace(/\D/g,''); setCashAmount(v?parseInt(v).toLocaleString('id-ID'):''); }} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold text-xl text-center mb-4" placeholder="Nominal Uang" />
                )}
                <button onClick={handleCheckout} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-lg">Proses</button>
              </div>
            </div>
          </div>
        )}

        {showSaveBillModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-3xl w-full max-w-sm"><h3 className="text-xl font-bold mb-4">Simpan Tagihan</h3><input autoFocus type="text" placeholder="Meja 4 / Nama" value={billName} onChange={e=>setBillName(e.target.value)} className="w-full p-3 rounded-xl border mb-4" /><div className="flex gap-2"><button onClick={()=>setShowSaveBillModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">Batal</button><button onClick={handleSaveBill} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Simpan</button></div></div>
          </div>
        )}

        {variantModal && (
          <VariantModal item={variantModal} onClose={() => setVariantModal(false)} onAdd={addToCartFinal} formatRp={formatRp} />
        )}
      </div>
    </div>
  );
}

function AdminOrderManager({ orders, members, menus, promos, db, formatRp, showToast, onPrint }) {
  const STATUS_OPTIONS = ['Menunggu Pembayaran', 'Pending', 'Diproses', 'Selesai', 'Dibatalkan'];
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [sortOrder, setSortOrder] = useState("Terbaru");
  
  const [expandedOrders, setExpandedOrders] = useState({});

  const toggleOrderDetails = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };
  
  const handleStatusChange = async (orderId, newStatus) => {
    const target = orders.find(o => o.dbId === orderId);
    if (!target) return;
    try {
      const updates = { status: newStatus };
      
      // Jika diproses ATAU langsung di-set ke selesai, potong stok!
      if (newStatus === 'Diproses' || newStatus === 'Selesai') {
        if (!target.isPointsAwarded && target.customer !== 'Walk-in / Cashier') {
          updates.isPointsAwarded = true;
          const member = members.find(m => m.name === target.customer && m.phone === target.customerPhone);
          if (member) await updateDoc(getDocRef('members', member.dbId), { points: (member.points || 0) + (target.earnedPoints || 0) });
        }
        if (!target.isStockDeducted) {
          updates.isStockDeducted = true;
          for (const item of target.items) {
            const menuTarget = menus.find(m => m.dbId === (item.dbId || item.originalId || item.id));
            if (menuTarget) {
              const deductQty = Number(item.quantity || item.qty || 1);
              const variantName = item.variant || item.variantId;
              
              const updatedVariants = menuTarget.variants.map(v => 
                v.name === variantName ? { ...v, qty: Math.max(0, Number(v.qty) - deductQty) } : v
              );
              
              const totalQty = updatedVariants.reduce((sum, v) => sum + (Number(v.qty) || 0), 0);
              const menuUpdates = { variants: updatedVariants };
              if (totalQty <= 0) menuUpdates.isActive = false; // AUTO HIDE jika stok 0
              
              await updateDoc(getDocRef('menu', menuTarget.dbId), menuUpdates);
            }
          }
        }
      } else if (newStatus === 'Dibatalkan') {
        // Kembalikan Stok jika pesanan dibatalkan
        if (target.isStockDeducted) {
          updates.isStockDeducted = false;
          for (const item of target.items) {
            const menuTarget = menus.find(m => m.dbId === (item.dbId || item.originalId || item.id));
            if (menuTarget) {
              const addQty = Number(item.quantity || item.qty || 1);
              const variantName = item.variant || item.variantId;
              
              const updatedVariants = menuTarget.variants.map(v => 
                v.name === variantName ? { ...v, qty: Number(v.qty) + addQty } : v
              );
              // Jadikan menu Aktif kembali karena stok bertambah
              await updateDoc(getDocRef('menu', menuTarget.dbId), { variants: updatedVariants, isActive: true });
            }
          }
        }
        
        // --- KEMBALIKAN STOK PROMO & CABUT STATUS PENGGUNAAN ---
        if (target.discount && target.discount.dbId) {
          const promoToUpdate = promos.find(p => p.dbId === target.discount.dbId);
          if (promoToUpdate) {
            const updatedUsedBy = (promoToUpdate.usedBy || []).filter(phone => phone !== target.customerPhone);
            await updateDoc(getDocRef('promos', promoToUpdate.dbId), {
              stock: (promoToUpdate.stock || 0) + 1,
              usedBy: updatedUsedBy
            });
          }
        }

        // Tarik kembali poin jika pelanggan membatalkan pesanan
        if (target.isPointsAwarded && target.customer !== 'Walk-in / Cashier') {
          updates.isPointsAwarded = false;
          const member = members.find(m => m.name === target.customer && m.phone === target.customerPhone);
          if (member) await updateDoc(getDocRef('members', member.dbId), { points: Math.max(0, (member.points || 0) - (target.earnedPoints || 0)) });
        }
      }
      
      await updateDoc(getDocRef('transactions', target.dbId), updates);
      showToast(`Status diubah ke ${newStatus}`);
    } catch(e) { showToast("Gagal update status", "error"); }
  };

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      const query = searchQuery.toLowerCase();
      const matchSearch = (o.customer && o.customer.toLowerCase().includes(query)) || (o.id && o.id.toLowerCase().includes(query));
      
      const matchStatus = filterStatus === 'Semua' || o.status === filterStatus;

      let matchDate = true;
      if (filterDate) {
        const [y, m, d] = filterDate.split('-');
        const idFormat1 = `${d}/${m}/${y}`;
        const idFormat2 = `${parseInt(d)}/${parseInt(m)}/${y}`;
        matchDate = o.filterDateKey === filterDate || (o.date && (o.date.includes(idFormat1) || o.date.includes(idFormat2)));
      }

      return matchSearch && matchStatus && matchDate;
    });

    return [...result].sort((a, b) => {
      const timeA = Number(a.timestamp) || 0;
      const timeB = Number(b.timestamp) || 0;
      if (sortOrder === "Terbaru") {
        return timeB - timeA;
      } else {
        return timeA - timeB;
      }
    });
  }, [orders, searchQuery, filterDate, filterStatus, sortOrder]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <div className="bg-white p-6 border-b border-slate-200 shadow-sm z-10 sticky top-0">
        <h2 className="text-2xl font-bold mb-4">Manajemen Pesanan</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-3 text-slate-400" />
            <input type="text" placeholder="Cari Nama / No Pesanan..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="flex flex-wrap gap-3">
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400" />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 font-semibold">
              <option value="Semua">Semua Status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 font-semibold">
              <option value="Terbaru">Waktu: Terbaru</option>
              <option value="Terlama">Waktu: Terlama</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <p className="text-center text-slate-500 mt-10">Tidak ada pesanan yang sesuai filter.</p>
          ) : (
            filteredOrders.map(order => (
              <div key={order.dbId} className={`p-5 rounded-2xl shadow-sm border flex flex-col gap-4 relative overflow-hidden transition-all duration-300 ${order.status === 'Menunggu Pembayaran' ? 'border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.3)] bg-blue-50/50' : 'bg-white border-slate-100'}`}>
                {order.status === 'Menunggu Pembayaran' && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 animate-pulse" />
                )}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <p className="font-bold text-lg">{order.id} <span className="text-slate-400 text-sm ml-2">{order.time} {order.date && `• ${order.date.split(',')[0]}`}</span></p>
                    <p className="text-sm font-semibold text-red-600">{order.customer}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <button onClick={() => toggleOrderDetails(order.dbId)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-colors">
                      {expandedOrders[order.dbId] ? <ChevronLeft className="rotate-90" size={18}/> : <ChevronLeft className="-rotate-90" size={18}/>}
                      {expandedOrders[order.dbId] ? 'Tutup' : 'Buka Pesanan'}
                    </button>
                    <button onClick={() => onPrint(order)} className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm">
                      <Printer size={18}/> Cetak
                    </button>
                    <select value={order.status} onChange={(e) => handleStatusChange(order.dbId, e.target.value)} className="p-2 border rounded-xl bg-slate-50 font-bold text-sm">
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={()=>deleteDoc(getDocRef('transactions', order.dbId))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={20}/></button>
                  </div>
                </div>

                {expandedOrders[order.dbId] && (
                  <div className="mt-2 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                    <h4 className="font-bold text-slate-800 text-sm mb-3">Daftar Item:</h4>
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="font-bold text-slate-800 mr-2">{(item.quantity || item.qty)}x</span>
                            <span className="font-semibold text-slate-700">{item.name}</span>
                            <p className="text-xs text-slate-500 mt-1 ml-6">Varian: {item.variant || item.variantId}</p>
                            {item.note && <p className="text-xs text-orange-600 italic mt-0.5 ml-6">Catatan: "{item.note}"</p>}
                          </div>
                          <span className="font-bold text-slate-700">{formatRp(item.price * (item.quantity || item.qty))}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex flex-col gap-1 items-end pt-3 border-t border-dashed border-slate-200">
                      <div className="flex justify-between w-56 text-sm text-slate-500">
                        <span>Subtotal:</span>
                        <span>{formatRp(order.originalTotal || order.total + (order.discount?.value || 0))}</span>
                      </div>
                      {order.discount && order.discount.value > 0 && (
                        <div className="flex justify-between w-56 text-sm text-green-600">
                          <span>Diskon Promo ({order.discount.code}):</span>
                          <span>-{formatRp(order.discount.value)}</span>
                        </div>
                      )}
                      <div className="flex justify-between w-56 text-base font-bold text-slate-800 mt-2 pt-2 border-t border-slate-200">
                        <span>Total Akhir:</span>
                        <span className="text-red-600">{formatRp(order.total)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AdminOpenBill({ savedBills, db, handleLoadBill }) {
  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-50"><h2 className="text-2xl font-bold mb-6">Tagihan Tersimpan (Open Bill)</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {savedBills.map(bill => (
          <div key={bill.dbId} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <h3 className="font-bold text-lg mb-1">{bill.name}</h3><p className="text-xs text-slate-400 mb-4">{bill.timeString}</p>
            <div className="flex gap-2 mt-auto"><button onClick={()=>handleLoadBill(bill)} className="flex-1 bg-red-100 text-red-700 py-2 rounded-lg font-bold text-sm">Buka Kasir</button><button onClick={()=>deleteDoc(getDocRef('savedBills', bill.dbId))} className="p-2 text-red-500 border rounded-lg"><Trash2 size={16}/></button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminMenuManager({ menus, db, formatRp, showToast }) {
  const [form, setForm] = useState(null);
  
  const handleToggleVisibility = async (id, currentStatus) => {
    try {
      await updateDoc(getDocRef('menu', id), { isActive: !currentStatus });
      showToast(currentStatus ? "Menu disembunyikan" : "Menu ditampilkan", "success");
    } catch(e) {
      showToast("Gagal mengubah status", "error");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if(form.variants.length === 0) return showToast("Minimal 1 varian!", "error");
    try {
      const data = { ...form, price: Number(form.price), orderPriority: Number(form.orderPriority)||99 };
      if(form.dbId) await updateDoc(getDocRef('menu', form.dbId), data);
      else await addDoc(getColRef('menu'), data);
      setForm(null); showToast("Menu disimpan");
    } catch(e) { showToast("Gagal menyimpan", "error"); }
  };

  if(form) return (
    <div className="flex-1 p-6 bg-white overflow-y-auto">
      <div className="flex justify-between mb-6"><h2 className="text-xl font-bold">Edit Menu</h2><button onClick={()=>setForm(null)}><X size={24}/></button></div>
      <form onSubmit={handleSave} className="max-w-2xl space-y-4">
        <div className="flex gap-4 items-center"><input type="checkbox" checked={form.isActive!==false} onChange={e=>setForm({...form, isActive: e.target.checked})} className="w-5 h-5 accent-red-600"/><label className="font-bold">Tampilkan di Kasir/App</label></div>
        <div><label className="font-bold text-sm">Nama</label><input required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
        <div><label className="font-bold text-sm">Deskripsi Singkat</label><textarea value={form.desc || ''} onChange={e=>setForm({...form, desc: e.target.value})} placeholder="Jelaskan komposisi makanan ini..." className="w-full p-3 border rounded-xl resize-none outline-none focus:border-slate-400" rows="2" /></div>
        <div className="flex gap-4"><div className="flex-1"><label className="font-bold text-sm">Harga (Rp)</label><input type="number" required value={form.price} onChange={e=>setForm({...form, price: e.target.value})} className="w-full p-3 border rounded-xl" /></div><div className="w-24"><label className="font-bold text-sm">Urutan</label><input type="number" value={form.orderPriority||99} onChange={e=>setForm({...form, orderPriority: e.target.value})} className="w-full p-3 border rounded-xl text-center" /></div></div>
        <div><label className="font-bold text-sm">URL Gambar</label><input required type="url" value={form.image} onChange={e=>setForm({...form, image: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
        <div className="border-t pt-4"><label className="font-bold mb-2 block">Varian & Stok <button type="button" onClick={()=>setForm({...form, variants: [...form.variants, {name:'',qty:0}]})} className="bg-slate-900 text-white px-2 py-1 rounded text-xs ml-2">Tambah</button></label>
          {form.variants.map((v, i) => <div key={i} className="flex gap-2 mb-2"><input required placeholder="Nama" value={v.name} onChange={e=>{const va=[...form.variants]; va[i].name=e.target.value; setForm({...form, variants:va})}} className="flex-1 p-2 border rounded-lg"/><input type="number" required value={v.qty} onChange={e=>{const va=[...form.variants]; va[i].qty=Number(e.target.value); setForm({...form, variants:va})}} className="w-20 p-2 border rounded-lg text-center"/><button type="button" onClick={()=>{const va=[...form.variants]; va.splice(i,1); setForm({...form, variants:va})}} className="p-2 text-red-500"><X size={16}/></button></div>)}
        </div>
        <button type="submit" className="w-full bg-red-600 text-white font-bold py-4 rounded-xl mt-6">Simpan Menu</button>
      </form>
    </div>
  );

  const sortedMenus = [...menus].sort((a, b) => {
    const aActive = a.isActive !== false;
    const bActive = b.isActive !== false;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return (a.orderPriority || 99) - (b.orderPriority || 99);
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-50"><div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Manajemen Menu</h2><button onClick={()=>setForm({name:'', desc:'', price:'', image:'', isActive:true, orderPriority:99, variants:[{name:'Reguler',qty:100}]})} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"><Plus size={18}/> Tambah</button></div>
      <div className="space-y-3">
        {sortedMenus.map((menu, index) => (
          <div key={menu.dbId} className={`bg-white p-4 rounded-2xl flex justify-between items-center ${menu.isActive===false?'opacity-50 grayscale':''}`}>
            <div className="flex gap-3 items-center">
              <span className="font-bold text-slate-400 text-lg w-6 text-center">{index + 1}</span>
              <img src={menu.image} className="w-16 h-16 rounded-xl object-cover" />
              <div><h3 className="font-bold">{menu.name} {menu.isActive === false && <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ml-2">Hidden</span>}</h3><p className="text-red-600 text-sm font-bold">{formatRp(menu.price)}</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleToggleVisibility(menu.dbId, menu.isActive !== false)} className={`p-2 rounded-lg ${menu.isActive !== false ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                {menu.isActive !== false ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <button onClick={()=>setForm(menu)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={18}/></button>
              <button onClick={()=>deleteDoc(getDocRef('menu', menu.dbId))} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminMemberManager({ members, db, showToast }) {
  const [editingMember, setEditingMember] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(getDocRef('members', editingMember.dbId), {
        name: editingMember.name,
        phone: editingMember.phone,
        points: Number(editingMember.points) 
      });
      setEditingMember(null);
      showToast("Data member berhasil diperbarui!", "success");
    } catch (error) {
      showToast("Gagal memperbarui data member", "error");
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-50 relative">
      <h2 className="text-2xl font-bold mb-6">Daftar Member</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {members.map(m => (
          <div key={m.dbId} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800">{m.name}</h3>
              <p className="text-slate-500 text-sm mt-0.5">{m.phone}</p>
              <p className="text-yellow-600 font-bold text-sm mt-1">{m.points || 0} Poin</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingMember(m)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                <Edit2 size={18} />
              </button>
              <button onClick={() => { if(window.confirm('Hapus member ini?')) deleteDoc(getDocRef('members', m.dbId)) }} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors">
                <Trash2 size={18}/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingMember && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50">
              <h3 className="font-black text-xl text-slate-800">Edit Member</h3>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Member</label>
                <input type="text" required value={editingMember.name} onChange={e => setEditingMember({...editingMember, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 focus:border-red-500 outline-none rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">No. WhatsApp</label>
                <input type="tel" required value={editingMember.phone} onChange={e => setEditingMember({...editingMember, phone: e.target.value})} className="w-full px-4 py-3 border border-slate-200 focus:border-red-500 outline-none rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Jumlah Poin</label>
                <input type="number" required value={editingMember.points} onChange={e => setEditingMember({...editingMember, points: e.target.value})} className="w-full px-4 py-3 border border-slate-200 focus:border-red-500 outline-none rounded-xl" />
              </div>
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl mt-4 transition-colors">
                Simpan Perubahan
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPromoManager({ promos, db, formatRp, showToast }) {
  const [form, setForm] = useState(null);
  
  const handleSave = async (e) => { 
    e.preventDefault(); 
    try { 
      const data = { ...form, value: Number(form.value), stock: Number(form.stock) };
      if (!data.usedBy) data.usedBy = []; // Ensure usedBy array is prepared
      
      if(form.dbId) await updateDoc(getDocRef('promos', form.dbId), data); 
      else await addDoc(getColRef('promos'), data); 
      
      setForm(null); 
      showToast("Promo disimpan"); 
    } catch(e){ 
      showToast("Gagal menyimpan promo", "error"); 
    } 
  };

  if(form) return (
    <div className="flex-1 p-6 bg-white">
      <div className="flex justify-between mb-6"><h2 className="text-xl font-bold">Edit Promo</h2><button onClick={()=>setForm(null)}><X size={24}/></button></div>
      <form onSubmit={handleSave} className="max-w-md space-y-4">
        <input required placeholder="KODE (Cth: PROMO50)" value={form.code} onChange={e=>setForm({...form, code:e.target.value.toUpperCase()})} className="w-full p-3 border rounded-xl uppercase"/>
        <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full p-3 border rounded-xl">
          <option value="percent">Persentase (%)</option>
          <option value="nominal">Nominal (Rp)</option>
        </select>
        <input required type="number" placeholder="Nilai Diskon" value={form.value} onChange={e=>setForm({...form, value:Number(e.target.value)})} className="w-full p-3 border rounded-xl"/>
        <input required type="number" placeholder="Stok / Kuota Promo" value={form.stock !== undefined ? form.stock : 100} onChange={e=>setForm({...form, stock:Number(e.target.value)})} className="w-full p-3 border rounded-xl"/>
        
        <div className="flex gap-2 items-center"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form, isActive:e.target.checked})} className="w-5 h-5 accent-red-600"/><label>Aktif</label></div>
        <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl">Simpan</button>
      </form>
    </div>
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-50"><div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Promo & Diskon</h2><button onClick={()=>setForm({code:'', type:'percent', value:0, stock:100, isActive:true, usedBy: []})} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold">Tambah</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promos.map(p => (
          <div key={p.dbId} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <h3 className="font-black text-xl">{p.code}</h3>
              <p className="text-slate-500 font-medium">
                {p.type==='percent'?`${p.value}%`:formatRp(p.value)} • Sisa Kuota: {p.stock !== undefined ? p.stock : '∞'} {p.isActive?'(Aktif)':'(Mati)'}
              </p>
            </div>
            <div className="flex gap-2"><button onClick={()=>setForm(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={18}/></button><button onClick={()=>deleteDoc(getDocRef('promos', p.dbId))} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18}/></button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
