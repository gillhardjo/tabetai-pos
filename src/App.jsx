import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, Trash2, Plus, Minus, Search, Settings, Tag, X, Image as ImageIcon, QrCode, Banknote, Save, FolderOpen, Database, Eye, EyeOff } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// Inisialisasi Firebase (Menggunakan Konfigurasi Tabetai App Anda)
const firebaseConfig = {
  apiKey: "AIzaSyAwsfBMS0_9gbPayYU-Ry2iFNfF8TMMKVU",
  authDomain: "tabetai-app-v103.firebaseapp.com",
  databaseURL: "https://tabetai-app-v103-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tabetai-app-v103",
  storageBucket: "tabetai-app-v103.firebasestorage.app",
  messagingSenderId: "555178920953",
  appId: "1:555178920953:web:96ab92b21b8212c57a0b28",
  measurementId: "G-6189BCY5YH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "tabetai-app-v103";

// Data awal jika database kosong
const initialMenu = [
  { id: "1", name: "Salmon Nigiri", category: "Sushi", price: 25000, image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&q=80", variants: [], isVisible: true },
  { id: "2", name: "Spicy Tuna Roll", category: "Sushi", price: 35000, image: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=300&q=80", variants: [{name: "Level 1", price: 0}, {name: "Level 3", price: 5000}], isVisible: true },
  { id: "3", name: "Chicken Shoyu Ramen", category: "Ramen", price: 45000, image: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=300&q=80", variants: [], isVisible: true },
  { id: "4", name: "Beef Curry Udon", category: "Ramen", price: 55000, image: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=300&q=80", variants: [], isVisible: true },
  { id: "5", name: "Ocha Dingin", category: "Minuman", price: 10000, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&q=80", variants: [{name: "Reguler", price: 0}, {name: "Large", price: 5000}], isVisible: true },
  { id: "6", name: "Edamame", category: "Snack", price: 15000, image: "https://images.unsplash.com/photo-1518131346059-e935b67a1c5d?w=300&q=80", variants: [], isVisible: true }
];
const initialCategories = ["Sushi", "Ramen", "Minuman", "Snack"];

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('kasir'); 
  const [authError, setAuthError] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // States dari Firebase
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState(["Semua"]);
  const [transactions, setTransactions] = useState([]);
  const [savedBills, setSavedBills] = useState([]);
  
  // Local States UI & Kasir
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);

  // Modals
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(''); 
  const [cashAmount, setCashAmount] = useState('');
  const [menuFormModal, setMenuFormModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [variantModal, setVariantModal] = useState({ show: false, item: null, selectedVariant: null });
  const [showSaveBillModal, setShowSaveBillModal] = useState(false);
  const [billName, setBillName] = useState("");
  const [notification, setNotification] = useState(null);
  
  // Tambahan state untuk custom modal konfirmasi
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onAction: null });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- FIREBASE INITIALIZATION & SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
        setAuthError(null);
      } catch (error) {
        console.error("Auth Error:", error);
        if (error.code === 'auth/configuration-not-found') {
          setAuthError('Anonymous Auth belum aktif! Buka Firebase Console > Authentication > Sign-in method > Aktifkan "Anonymous".');
        } else {
          setAuthError(error.message);
        }
      } finally {
        setIsAuthReady(true);
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    // Mendengarkan perubahan data Menu
    const unsubMenu = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'menu'), (snap) => {
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setMenuItems(items);
    }, (err) => console.error("Menu fetch error:", err));

    // Mendengarkan perubahan data Kategori
    const unsubCat = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), (snap) => {
      const cats = snap.docs.map(doc => doc.data().name);
      setCategories(["Semua", ...cats]);
    }, (err) => console.error("Categories fetch error:", err));

    // Mendengarkan perubahan data Transaksi
    const unsubTrx = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), (snap) => {
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      items.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(items);
    }, (err) => console.error("Transactions fetch error:", err));

    // Mendengarkan perubahan data Open Bills
    const unsubBill = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'savedBills'), (snap) => {
      const items = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      items.sort((a, b) => b.timestamp - a.timestamp);
      setSavedBills(items);
    }, (err) => console.error("Bills fetch error:", err));

    return () => { unsubMenu(); unsubCat(); unsubTrx(); unsubBill(); };
  }, [isAuthReady]); // Mengandalkan isAuthReady agar tetap mencoba mengambil data jika rules Firebase diset ke public

  // --- FUNGSI SEED DATA DUMMY (Jika database kosong) ---
  const handleSeedDatabase = async () => {
    if (authError) return showNotification("Gagal: Pastikan error Authentication di atas diperbaiki terlebih dahulu.", "error");
    try {
      showNotification("Menyiapkan data awal...", "info");
      for (const item of initialMenu) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menu', item.id), item);
      }
      for (const cat of initialCategories) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', cat), { name: cat });
      }
      showNotification("Data awal berhasil dimuat!", "success");
    } catch (error) {
      showNotification("Gagal memuat data awal (Periksa Rules Firestore Anda)", "error");
      console.error(error);
    }
  };

  const toggleMenuVisibility = async (item) => {
    const newVisibility = item.isVisible === false ? true : false;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menu', item.id), { isVisible: newVisibility }, { merge: true });
      showNotification(`${item.name} sekarang ${newVisibility ? 'ditampilkan' : 'disembunyikan'}`, "success");
    } catch (error) {
      showNotification("Gagal mengubah visibilitas", "error");
    }
  };

  // --- KASIR & KERANJANG LOGIC ---
  const filteredMenu = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Semua" || item.category === selectedCategory;
    const isVisible = item.isVisible !== false; // Mengabaikan jika undefined (dianggap tampil)
    return matchesSearch && matchesCategory && isVisible;
  });

  const handleAddToCart = (item) => {
    if (item.variants && item.variants.length > 0) {
      setVariantModal({ show: true, item: item, selectedVariant: item.variants[0] });
    } else {
      addToCartFinal(item, null);
    }
  };

  const addToCartFinal = (item, variant) => {
    const itemPrice = variant ? item.price + variant.price : item.price;
    const itemName = variant ? `${item.name} (${variant.name})` : item.name;
    const variantId = variant ? variant.name : 'default';

    const existingItemIndex = cart.findIndex(c => c.id === item.id && c.variantId === variantId);
    
    if (existingItemIndex > -1) {
      const newCart = [...cart];
      newCart[existingItemIndex].qty += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { ...item, name: itemName, price: itemPrice, qty: 1, variantId: variantId, originalId: item.id }]);
    }
    
    if (variantModal.show) {
      setVariantModal({ show: false, item: null, selectedVariant: null });
    }
  };

  const updateCartQty = (id, variantId, delta) => {
    setCart((prevCart) => {
      return prevCart.map(item => {
        if (item.id === id && item.variantId === variantId) {
          return { ...item, qty: item.qty + delta };
        }
        return item;
      }).filter(item => item.qty > 0);
    });
  };

  const applyPromoCode = () => {
    if (promoCode.toUpperCase() === 'PROMO20') {
      const sub = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      setDiscount(sub * 0.2);
      showNotification("Promo 20% berhasil digunakan!", "success");
    } else {
      setDiscount(0);
      showNotification("Kode promo tidak valid", "error");
    }
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const calculateTotal = () => Math.max(0, calculateSubtotal() - discount);
  const calculateChange = () => {
    if (!cashAmount) return 0;
    return parseInt(cashAmount.replace(/\D/g, '')) - calculateTotal();
  };

  // --- FIREBASE CRUD LOGIC ---
  const handleCheckout = async () => {
    if (authError) return showNotification("Sistem offline: Perbaiki error Auth.", "error");
    if (!paymentMethod) return showNotification("Pilih metode pembayaran!", "error");
    if (paymentMethod === 'Cash' && calculateChange() < 0) return showNotification("Uang tunai kurang!", "error");

    const id = `TRX-${Date.now().toString().slice(-6)}`;
    const newTrx = {
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      status: "Selesai",
      items: [...cart],
      total: calculateTotal(),
      payment: paymentMethod
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id), newTrx);
      setCart([]);
      setPromoCode("");
      setDiscount(0);
      setPaymentMethod('');
      setCashAmount('');
      setCheckoutModal(false);
      showNotification("Pembayaran Berhasil! Struk siap dicetak.", "success");
    } catch (error) {
      showNotification("Gagal memproses pembayaran (Periksa Rules Firestore)", "error");
    }
  };

  const updateOrderStatus = async (id, newStatus) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id), { status: newStatus }, { merge: true });
      showNotification(`Status pesanan diubah ke ${newStatus}`, "success");
    } catch (error) {
      showNotification("Gagal mengubah status", "error");
    }
  };

  const deleteOrder = (id) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Pesanan',
      message: `Apakah Anda yakin ingin menghapus riwayat pesanan ${id}?`,
      onAction: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id));
          showNotification(`Pesanan ${id} dihapus`, "info");
        } catch (error) {
          showNotification("Gagal menghapus pesanan", "error");
        }
        setConfirmModal({ show: false, title: '', message: '', onAction: null });
      }
    });
  };

  const handleSaveBill = async () => {
    if (authError) return showNotification("Sistem offline: Perbaiki error Auth.", "error");
    if (cart.length === 0) return showNotification("Keranjang kosong", "error");
    if (!billName) return showNotification("Nama meja/pelanggan harus diisi", "error");

    const id = `BILL-${Date.now()}`;
    const newBill = {
      name: billName,
      items: [...cart],
      timeString: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'savedBills', id), newBill);
      setCart([]);
      setPromoCode("");
      setDiscount(0);
      setShowSaveBillModal(false);
      setBillName("");
      showNotification(`Bill '${billName}' berhasil disimpan`, "success");
    } catch (error) {
      showNotification("Gagal menyimpan bill", "error");
    }
  };

  const handleLoadBill = (bill) => {
    if (cart.length > 0) {
      setConfirmModal({
        show: true,
        title: 'Timpa Keranjang?',
        message: 'Keranjang saat ini tidak kosong. Mengganti dengan bill ini akan menghapus isi keranjang. Lanjutkan?',
        onAction: () => processLoadBill(bill)
      });
    } else {
      processLoadBill(bill);
    }
  };

  const processLoadBill = async (bill) => {
    try {
      setCart(bill.items);
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'savedBills', bill.id));
      showNotification(`Bill '${bill.name}' dibuka kembali`, "info");
      setActiveTab("kasir");
    } catch (error) {
      showNotification("Gagal memuat bill", "error");
    }
    setConfirmModal({ show: false, title: '', message: '', onAction: null });
  };

  const handleDeleteSavedBill = (id, name) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Bill Permanen',
      message: `Hapus tagihan '${name}' secara permanen? Data tidak bisa dikembalikan.`,
      onAction: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'savedBills', id));
          showNotification(`Bill '${name}' dihapus`, "info");
        } catch (error) {
          showNotification("Gagal menghapus bill", "error");
        }
        setConfirmModal({ show: false, title: '', message: '', onAction: null });
      }
    });
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if(newCategoryName && !categories.includes(newCategoryName)) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', newCategoryName), { name: newCategoryName });
        setNewCategoryName("");
        showNotification("Kategori ditambahkan", "success");
      } catch (error) {
        showNotification("Gagal menambah kategori", "error");
      }
    }
  };

  const handleDeleteCategory = (cat) => {
    if (cat === "Semua") return;
    setConfirmModal({
      show: true,
      title: 'Hapus Kategori',
      message: `Hapus kategori ${cat}? Pastikan tidak ada menu yang menggunakan kategori ini.`,
      onAction: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', cat));
          showNotification("Kategori dihapus", "info");
          if (selectedCategory === cat) setSelectedCategory("Semua");
        } catch (error) {
          showNotification("Gagal menghapus kategori", "error");
        }
        setConfirmModal({ show: false, title: '', message: '', onAction: null });
      }
    });
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = editingMenu?.id || `MENU-${Date.now()}`;
    
    const newMenu = {
      name: formData.get('name'),
      category: formData.get('category'),
      price: parseInt(formData.get('price')),
      image: formData.get('image') || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80",
      variants: editingMenu?.variants || [],
      isVisible: formData.get('isVisible') === 'on'
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menu', id), newMenu);
      showNotification(editingMenu ? "Menu diperbarui" : "Menu baru ditambahkan", "success");
      setMenuFormModal(false);
      setEditingMenu(null);
    } catch (error) {
      showNotification("Gagal menyimpan menu", "error");
    }
  };

  const handleDeleteMenu = (id) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Menu',
      message: 'Apakah Anda yakin ingin menghapus menu ini dari database?',
      onAction: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menu', id));
          showNotification("Menu dihapus", "info");
        } catch (error) {
          showNotification("Gagal menghapus menu", "error");
        }
        setConfirmModal({ show: false, title: '', message: '', onAction: null });
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      
      {/* Error Banner jika Auth Firebase Belum Aktif */}
      {authError && (
        <div className="bg-red-600 text-white p-2.5 text-center text-sm font-bold shadow-md z-[100] animate-in slide-in-from-top-full">
          ⚠️ ERROR: {authError}
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white font-semibold shadow-lg z-[110] flex items-center gap-2 transition-all ${notification.type === 'error' ? 'bg-red-500' : notification.type === 'info' ? 'bg-blue-500' : 'bg-green-500'}`}>
          {notification.type === 'success' && <CheckCircle2 size={20} />}
          {notification.message}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <div className="w-24 md:w-64 bg-white shadow-xl flex flex-col justify-between z-10 transition-all duration-300">
          <div>
            <div className="p-4 md:p-6 flex items-center justify-center md:justify-start gap-3 border-b border-slate-100">
              <img src="https://github.com/gillhardjo/tabetai-app/blob/main/public/logo.png?raw=true" alt="Tabetai Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain bg-slate-900 rounded-xl p-1" />
              <h1 className="text-xl font-black text-slate-800 hidden md:block">Tabetai<span className="text-orange-500">POS</span></h1>
            </div>
            
            <nav className="p-4 space-y-2">
              <button 
                onClick={() => setActiveTab('kasir')}
                className={`w-full flex items-center gap-3 px-3 py-3 md:px-4 rounded-xl transition-colors ${activeTab === 'kasir' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-orange-50'}`}
                title="Kasir"
              >
                <ChefHat size={22} className="mx-auto md:mx-0"/>
                <span className="font-bold hidden md:block">Kasir</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('pesanan')}
                className={`w-full flex items-center gap-3 px-3 py-3 md:px-4 rounded-xl transition-colors ${activeTab === 'pesanan' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-orange-50'}`}
                title="Pesanan"
              >
                <Clock size={22} className="mx-auto md:mx-0"/>
                <span className="font-bold hidden md:block">Pesanan</span>
              </button>

              <button 
                onClick={() => setActiveTab('openbill')}
                className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 md:px-4 rounded-xl transition-colors relative ${activeTab === 'openbill' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-orange-50'}`}
                title="Open Bill"
              >
                <FolderOpen size={22} className="mx-auto md:mx-0"/>
                <span className="font-bold hidden md:block">Open Bill</span>
                {savedBills.length > 0 && (
                  <span className="absolute top-2 right-2 md:static md:ml-auto bg-red-500 text-white text-[10px] md:text-xs px-2 py-0.5 rounded-full font-bold">
                    {savedBills.length}
                  </span>
                )}
              </button>
              
              <button 
                onClick={() => setActiveTab('menu')}
                className={`w-full flex items-center gap-3 px-3 py-3 md:px-4 rounded-xl transition-colors ${activeTab === 'menu' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-orange-50'}`}
                title="Menu Admin"
              >
                <Settings size={22} className="mx-auto md:mx-0"/>
                <span className="font-bold hidden md:block">Menu Admin</span>
              </button>
            </nav>
          </div>
          
          <div className="p-4 border-t border-slate-100 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${user ? 'bg-green-500' : (authError ? 'bg-red-500' : 'bg-yellow-500')}`}></div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-slate-400">{user ? 'Online (Firebase)' : (authError ? 'Offline (Auth Error)' : 'Menghubungkan...')}</p>
              <p className="text-sm font-bold text-slate-700">Tabetai Admin</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* PESANAN */}
          {activeTab === 'pesanan' && (
            <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
              <h1 className="text-2xl font-bold text-slate-800 mb-6">Manajemen Pesanan</h1>
              <div className="flex flex-col gap-4">
                {transactions.length === 0 ? (
                  <div className="text-center text-slate-400 mt-10">Belum ada pesanan</div>
                ) : (
                  transactions.map((trx) => (
                    <div key={trx.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                      <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-slate-100 pb-4 mb-4 gap-4">
                        <div>
                          <span className="font-bold text-slate-800 text-lg mr-3">{trx.id}</span>
                          <span className="text-slate-400 text-sm">{trx.time} • {trx.payment}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 p-1 bg-slate-50 md:bg-slate-100 rounded-lg">
                          <button onClick={() => updateOrderStatus(trx.id, 'Pending')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-1 ${trx.status === 'Pending' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>
                            <Clock size={14}/> Pending
                          </button>
                          <button onClick={() => updateOrderStatus(trx.id, 'Diproses')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-1 ${trx.status === 'Diproses' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>
                            <ChefHat size={14}/> Diproses
                          </button>
                          <button onClick={() => updateOrderStatus(trx.id, 'Selesai')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-1 ${trx.status === 'Selesai' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>
                            <CheckCircle2 size={14}/> Selesai
                          </button>
                          <div className="w-px bg-slate-300 mx-1 hidden md:block"></div>
                          <button onClick={() => deleteOrder(trx.id)} className="px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-1 text-red-600 hover:bg-red-100 transition-colors">
                            <Trash2 size={14}/> Hapus
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          {trx.items.map((item, idx) => (
                            <div key={idx} className="text-slate-600 font-medium">
                              {item.qty}x {item.name}
                            </div>
                          ))}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-400 mb-1">Total Pesanan</div>
                          <div className="text-xl font-bold text-slate-800">Rp {trx.total.toLocaleString('id-ID')}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* OPEN BILL */}
          {activeTab === 'openbill' && (
            <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
              <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FolderOpen className="text-orange-500" />
                Daftar Tagihan Tersimpan
              </h1>
              
              {savedBills.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300 p-10">
                  <FolderOpen size={64} className="mb-4 text-slate-300" strokeWidth={1}/>
                  <p className="text-lg font-medium text-slate-500">Tidak ada tagihan yang tersimpan</p>
                  <p className="text-sm">Gunakan tombol "Simpan Bill" di kasir untuk menyimpan pesanan sementara.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedBills.map((bill) => (
                    <div key={bill.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -z-0"></div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                          <h3 className="font-bold text-xl text-slate-800 mb-1">{bill.name}</h3>
                          <p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/> {bill.timeString}</p>
                        </div>
                        <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-sm">{bill.items.length} Item</span>
                      </div>
                      
                      <div className="flex-1 mb-6 relative z-10 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <ul className="text-sm text-slate-600 space-y-1.5">
                          {bill.items.slice(0, 3).map((item, idx) => (
                            <li key={idx} className="flex justify-between items-center">
                              <span className="truncate pr-2 font-medium">{item.qty}x {item.name}</span>
                            </li>
                          ))}
                          {bill.items.length > 3 && (
                            <li className="text-slate-400 italic text-xs pt-1 border-t border-slate-200 mt-2">...dan {bill.items.length - 3} item lainnya</li>
                          )}
                        </ul>
                      </div>

                      <div className="flex gap-2 mt-auto relative z-10">
                        <button 
                          onClick={() => handleLoadBill(bill)}
                          className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors shadow-md shadow-orange-200 flex justify-center items-center gap-2"
                        >
                          <ChefHat size={16}/> Buka di Kasir
                        </button>
                        <button 
                          onClick={() => handleDeleteSavedBill(bill.id, bill.name)}
                          className="px-4 py-2.5 bg-white border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                          title="Hapus Bill Permanen"
                        >
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MENU ADMIN */}
          {activeTab === 'menu' && (
            <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Manajemen Menu</h1>
                <div className="flex gap-3">
                  {menuItems.length === 0 && (
                    <button onClick={handleSeedDatabase} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-slate-700">
                      <Database size={20} /> Isi Data Dummy
                    </button>
                  )}
                  <button onClick={() => setCategoryModal(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 shadow-sm">
                    Kelola Kategori
                  </button>
                  <button onClick={() => { setEditingMenu(null); setMenuFormModal(true); }} className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 shadow-md">
                    <Plus size={20} /> Tambah Menu
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm">
                    <tr>
                      <th className="p-4 font-semibold">Produk</th>
                      <th className="p-4 font-semibold">Kategori</th>
                      <th className="p-4 font-semibold">Harga</th>
                      <th className="p-4 font-semibold">Varian</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {menuItems.length === 0 ? (
                      <tr><td colSpan="6" className="p-8 text-center text-slate-400">Database Menu Kosong. Klik "Isi Data Dummy" atau "Tambah Menu"</td></tr>
                    ) : (
                      menuItems.map(item => (
                        <tr key={item.id} className={`transition-colors ${item.isVisible === false ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                          <td className="p-4 flex items-center gap-3">
                            <img src={item.image} alt={item.name} className={`w-12 h-12 rounded-xl object-cover ${item.isVisible === false ? 'grayscale opacity-50' : ''}`} />
                            <span className={`font-bold ${item.isVisible === false ? 'text-slate-400' : 'text-slate-800'}`}>{item.name}</span>
                          </td>
                          <td className="p-4 text-slate-600">{item.category}</td>
                          <td className="p-4 font-bold text-slate-800">Rp {item.price.toLocaleString('id-ID')}</td>
                          <td className="p-4 text-sm text-slate-500">
                            {item.variants?.length > 0 ? `${item.variants.length} Opsi` : '-'}
                          </td>
                          <td className="p-4 text-sm">
                            <button 
                              onClick={() => toggleMenuVisibility(item)} 
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors ${item.isVisible === false ? 'bg-slate-200 text-slate-500 hover:bg-slate-300' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                              title={item.isVisible === false ? "Tampilkan Menu" : "Sembunyikan Menu"}
                            >
                              {item.isVisible === false ? <><EyeOff size={14}/> Sembunyi</> : <><Eye size={14}/> Tampil</>}
                            </button>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setEditingMenu(item); setMenuFormModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">Edit</button>
                              <button onClick={() => handleDeleteMenu(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* KASIR */}
          {activeTab === 'kasir' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50">
              {/* Kiri: Daftar Menu */}
              <div className="flex-[2] flex flex-col h-full border-r border-slate-200">
                <div className="p-4 bg-white z-10 flex flex-col gap-4 shadow-sm">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text" 
                      placeholder="Cari nama menu..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all font-medium"
                    />
                  </div>
                  
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm ${selectedCategory === cat ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
                  {menuItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <p className="mb-2">Menu belum tersedia.</p>
                      <button onClick={() => setActiveTab('menu')} className="text-orange-500 font-bold underline">Ke Halaman Admin</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredMenu.map((item) => (
                        <div 
                          key={item.id} 
                          onClick={() => handleAddToCart(item)}
                          className="bg-white rounded-2xl p-3 border border-slate-100 hover:border-orange-300 hover:shadow-lg cursor-pointer transition-all group flex flex-col h-full"
                        >
                          <div className="w-full aspect-square bg-slate-100 rounded-xl mb-3 flex items-center justify-center text-4xl overflow-hidden relative">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                            {item.variants?.length > 0 && (
                              <div className="absolute bottom-2 right-2 bg-slate-900/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md">Varian</div>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{item.name}</h3>
                          <div className="mt-auto">
                            <p className="text-orange-600 font-black text-sm">Rp {item.price.toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Kanan: Keranjang (Cart) */}
            <div className="w-full md:w-[350px] lg:w-[400px] bg-white flex flex-col h-[50vh] md:h-full border-t md:border-t-0 border-slate-200">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  Pesanan <span className="bg-orange-100 text-orange-600 text-sm py-0.5 px-2 rounded-full">{cart.reduce((a,c)=>a+c.qty,0)}</span>
                </h2>
                {cart.length > 0 && (
                  <button 
                    onClick={() => setConfirmModal({
                      show: true, 
                      title: 'Kosongkan Keranjang', 
                      message: 'Hapus semua item yang ada di keranjang?', 
                      onAction: () => { setCart([]); setConfirmModal({show: false, title: '', message: '', onAction: null}); }
                    })} 
                    className="text-red-500 text-sm font-semibold hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
                        <ChefHat size={40} className="text-slate-300" />
                      </div>
                      <p className="font-medium">Keranjang masih kosong</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item, index) => (
                        <div key={`${item.id}-${item.variantId}-${index}`} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                            <p className="text-orange-500 font-bold text-xs">Rp {(item.price * item.qty).toLocaleString('id-ID')}</p>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                            <button 
                              onClick={() => updateCartQty(item.id, item.variantId, -1)}
                              className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-md shadow-sm hover:text-red-500"
                            >
                              {item.qty === 1 ? <Trash2 size={14}/> : <Minus size={14}/>}
                            </button>
                            <span className="w-4 text-center font-bold text-sm text-slate-700">{item.qty}</span>
                            <button 
                              onClick={() => updateCartQty(item.id, item.variantId, 1)}
                              className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-md shadow-sm hover:text-green-600"
                            >
                              <Plus size={14}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border-t border-slate-100 p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-20">
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Kode Promo (Coba: PROMO20)" 
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-500 uppercase"
                      />
                    </div>
                    <button onClick={applyPromoCode} className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700">
                      Terapkan
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-slate-700">Rp {calculateSubtotal().toLocaleString('id-ID')}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between items-center text-sm text-green-600">
                        <span>Diskon Promo</span>
                        <span className="font-semibold">- Rp {discount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Total Akhir</span>
                      <span className="text-2xl font-black text-slate-900">Rp {calculateTotal().toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => { if (cart.length > 0) setShowSaveBillModal(true); }}
                      className={`px-4 py-3 rounded-xl font-bold flex justify-center items-center transition-all ${cart.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-orange-100 text-orange-600 hover:bg-orange-200 border border-orange-200'}`}
                      title="Simpan Bill"
                    >
                      <Save size={24} />
                    </button>
                    <button 
                      onClick={() => { if (cart.length > 0) setCheckoutModal(true); }}
                      className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg ${cart.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-orange-600 text-white hover:bg-orange-700 hover:shadow-orange-200'}`}
                    >
                      Pilih Pembayaran
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- MODALS --- */}
          {variantModal.show && variantModal.item && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800">Pilih Varian</h3>
                  <button onClick={() => setVariantModal({ show: false, item: null, selectedVariant: null })} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3 mb-4">
                    <img src={variantModal.item.image} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    <div>
                      <h4 className="font-bold text-slate-800">{variantModal.item.name}</h4>
                      <p className="text-orange-500 font-semibold text-sm">Rp {variantModal.item.price.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                  {variantModal.item.variants.map((v, i) => (
                    <label key={i} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${variantModal.selectedVariant?.name === v.name ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-orange-200'}`}>
                      <div className="flex items-center gap-3">
                        <input 
                          type="radio" 
                          name="variant" 
                          checked={variantModal.selectedVariant?.name === v.name}
                          onChange={() => setVariantModal({...variantModal, selectedVariant: v})}
                          className="w-5 h-5 text-orange-500 focus:ring-orange-500 border-slate-300"
                        />
                        <span className="font-semibold text-slate-700">{v.name}</span>
                      </div>
                      <span className="text-slate-500 text-sm font-medium">{v.price > 0 ? `+ Rp ${v.price.toLocaleString('id-ID')}` : 'Gratis'}</span>
                    </label>
                  ))}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={() => addToCartFinal(variantModal.item, variantModal.selectedVariant)}
                    className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition-colors"
                  >
                    Tambah ke Keranjang
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSaveBillModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                    <Save size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Simpan Bill</h3>
                </div>
                <p className="text-sm text-slate-500 mb-6">Masukkan nama pelanggan atau nomor meja untuk menyimpan pesanan ini dan membukanya nanti di tab Open Bill.</p>
                <input 
                  type="text" 
                  placeholder="Contoh: Meja 4 / Budi" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-6 text-lg font-medium text-slate-800"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBill()}
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowSaveBillModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Batal</button>
                  <button onClick={handleSaveBill} disabled={!billName} className={`flex-1 py-3 rounded-xl font-bold text-white transition-colors ${billName ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-300 cursor-not-allowed'}`}>Simpan Bill</button>
                </div>
              </div>
            </div>
          )}

          {checkoutModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="text-xl font-black text-slate-800">Selesaikan Pembayaran</h3>
                  <button onClick={() => setCheckoutModal(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-6 overflow-y-auto">
                  <div className="text-center mb-6">
                    <p className="text-sm text-slate-500 font-medium mb-1">Total Tagihan</p>
                    <p className="text-4xl font-black text-orange-600 tracking-tight">Rp {calculateTotal().toLocaleString('id-ID')}</p>
                  </div>
                  <div className="space-y-4 mb-6">
                    <p className="font-bold text-slate-700 text-sm uppercase tracking-wider">Metode Pembayaran</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setPaymentMethod('Cash')} className={`py-4 rounded-2xl font-bold border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'Cash' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-orange-200'}`}>
                        <Banknote size={28} /> Tunai
                      </button>
                      <button onClick={() => setPaymentMethod('QRIS')} className={`py-4 rounded-2xl font-bold border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'QRIS' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-orange-200'}`}>
                        <QrCode size={28} /> QRIS / E-Wallet
                      </button>
                    </div>
                  </div>
                  {paymentMethod === 'Cash' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                      <label className="font-bold text-slate-700 text-sm uppercase tracking-wider">Nominal Diterima</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">Rp</span>
                        <input 
                          type="text" 
                          value={cashAmount}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setCashAmount(val ? parseInt(val).toLocaleString('id-ID') : '');
                          }}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xl focus:border-orange-500 focus:outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                      {cashAmount && calculateChange() >= 0 && (
                        <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex justify-between items-center">
                          <span className="text-green-800 font-semibold">Kembalian</span>
                          <span className="text-green-700 font-black text-xl">Rp {calculateChange().toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-5 border-t border-slate-100 bg-slate-50 mt-auto">
                  <button onClick={handleCheckout} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-lg hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all active:scale-[0.98]">
                    Proses Pembayaran
                  </button>
                </div>
              </div>
            </div>
          )}

          {categoryModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-lg text-slate-800">Kelola Kategori</h3>
                  <button onClick={() => setCategoryModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                </div>
                <div className="p-4">
                  <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                    <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nama Kategori Baru" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500" required />
                    <button type="submit" className="px-3 py-2 bg-slate-800 text-white rounded-lg font-bold"><Plus size={20}/></button>
                  </form>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {categories.filter(c => c !== "Semua").map(cat => (
                      <div key={cat} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="font-medium text-slate-700">{cat}</span>
                        <button onClick={() => handleDeleteCategory(cat)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {menuFormModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-lg text-slate-800">{editingMenu ? 'Edit Menu' : 'Tambah Menu Baru'}</h3>
                  <button onClick={() => setMenuFormModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                </div>
                <form onSubmit={handleSaveMenu}>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Nama Produk</label>
                      <input type="text" name="name" defaultValue={editingMenu?.name} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Kategori</label>
                        <select name="category" defaultValue={editingMenu?.category || categories[1]} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none">
                          {categories.filter(c => c !== "Semua").map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Harga (Rp)</label>
                        <input type="number" name="price" defaultValue={editingMenu?.price} required min="0" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">URL Foto Produk</label>
                      <div className="relative">
                        <ImageIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="url" name="image" defaultValue={editingMenu?.image} placeholder="https://..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Biarkan kosong untuk foto default.</p>
                    </div>
                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input 
                        type="checkbox" 
                        name="isVisible" 
                        defaultChecked={editingMenu ? editingMenu.isVisible !== false : true} 
                        className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500 border-slate-300"
                      />
                      <div>
                        <p className="font-bold text-slate-700 text-sm">Tampilkan di Menu</p>
                        <p className="text-xs text-slate-500">Bisa diubah kapan saja di tabel Admin.</p>
                      </div>
                    </label>
                  </div>
                  <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button type="button" onClick={() => setMenuFormModal(false)} className="px-5 py-2 font-bold text-slate-600 bg-slate-200 rounded-xl hover:bg-slate-300">Batal</button>
                    <button type="submit" className="px-5 py-2 font-bold text-white bg-orange-600 rounded-xl hover:bg-orange-700 shadow-md">Simpan</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Konfirmasi Hapus (Custom Confirm Dialog) */}
          {confirmModal.show && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">{confirmModal.title}</h3>
                <p className="text-slate-500 mb-8 font-medium">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmModal({ show: false, title: '', message: '', onAction: null })} 
                    className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => confirmModal.onAction && confirmModal.onAction()} 
                    className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                  >
                    Ya, Lanjutkan
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
