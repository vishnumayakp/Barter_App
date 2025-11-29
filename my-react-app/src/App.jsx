import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import './App.css'
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Home, PlusCircle, MessageCircle, User, Search, Repeat, MapPin, 
  CheckCircle, XCircle, Send, Package, ArrowRightLeft, Filter, 
  Sparkles, Bot, ArrowRight, ShieldCheck, Lock, Mail, Star, LogOut 
} from 'lucide-react';

import { app, db, auth,appId } from './firebaseConfig';

// --- Firebase Initialization (Environment Aware) ---
// const firebaseConfig = JSON.parse(__firebase_config);
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);
// const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Constants & Utilities ---
const apiKey = ""; // Environment provides this automatically

const CATEGORIES = ['Electronics', 'Stationery', 'Books', 'Clothing', 'Home', 'Tools', 'Other'];
const CONDITIONS = ['Unpacked', 'Excellent', 'Good', 'Minor Defects', 'Bad', 'Scrap'];
const TYPES = ['Barter', 'Giveaway'];

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const calculateAge = (dateString) => {
  if (!dateString) return '';
  const today = new Date();
  const mfgDate = new Date(dateString);
  let age = today.getFullYear() - mfgDate.getFullYear();
  const monthDiff = today.getMonth() - mfgDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < mfgDate.getDate())) {
    age--;
  }
  return age > 0 ? `${age} years old` : 'Less than a year old';
};

const callGemini = async (prompt, isJson = false) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: isJson ? { responseMimeType: "application/json" } : {}
        })
      }
    );
    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return isJson ? JSON.parse(text) : text;
  } catch (error) {
    console.error("Gemini Interaction Failed:", error);
    return null;
  }
};

// --- CSS Styles ---
const styles = `
  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  .animate-blob {
    animation: blob 7s infinite;
  }
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }
  .animate-slide-in-right {
    animation: slideInRight 0.3s ease-out;
  }
  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
`;

// --- Auth Components ---

const WelcomeScreen = ({ onStart }) => (
  <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-6 relative overflow-hidden text-center">
    <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
    <div className="z-10 bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl max-w-sm w-full">
      <div className="bg-white w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg transform -rotate-3">
        <ArrowRightLeft className="text-indigo-600" size={40} strokeWidth={3} />
      </div>
      <h1 className="text-4xl font-black text-white mb-2 tracking-tight">BARTER</h1>
      <p className="text-indigo-100 font-medium mb-8 text-lg">
        Trade items. Zero money.<br />Sustainable Exchange.
      </p>
      <div className="space-y-3">
        <button onClick={() => onStart('login')} className="w-full bg-white text-indigo-600 font-bold py-3.5 rounded-xl shadow-lg hover:bg-indigo-50 transition-all">
          Log In
        </button>
        <button onClick={() => onStart('register')} className="w-full bg-indigo-800/50 text-white font-bold py-3.5 rounded-xl border border-indigo-400/30 hover:bg-indigo-800/70 transition-all">
          Create Account
        </button>
      </div>
    </div>
  </div>
);

const LoginScreen = ({ onLogin, onBack, onForgot }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <button onClick={onBack} className="self-start text-gray-500 mb-8">
        <ArrowRight className="transform rotate-180" /> Back
      </button>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
      <p className="text-gray-500 mb-8">Log in to manage your exchanges.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Email ID</label>
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden">
            <div className="pl-4 pr-3 text-gray-400 border-r border-gray-200">
              <Mail size={18} />
            </div>
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="w-full p-3 bg-transparent border-none text-black focus:ring-0 font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden">
            <div className="pl-4 pr-3 text-gray-400 border-r border-gray-200">
              <Lock size={18} />
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full p-3 bg-transparent border-none text-black focus:ring-0 font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
          Log In
        </button>
        <div className="text-center">
          <button type="button" onClick={onForgot} className="text-sm text-indigo-600 font-semibold hover:underline">
            Forgot Password?
          </button>
        </div>
      </form>
    </div>
  );
};

const ForgotPasswordScreen = ({ onBack }) => {
  const [step, setStep] = useState(1);
  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <button onClick={onBack} className="self-start text-gray-500 mb-8">
        <ArrowRight className="transform rotate-180" /> Back
      </button>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h2>
      {step === 1 ? (
        <div className="space-y-6">
          <p className="text-gray-500">Enter your registered email and mobile number.</p>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email ID</label>
            <input type="email" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" placeholder="you@example.com" />
          </div>
          <button onClick={() => setStep(2)} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg">
            Verify & Send OTP
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-gray-500">Enter the 4-digit OTP sent to your email.</p>
          <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-center tracking-widest text-2xl font-bold" placeholder="0 0 0 0" />
          <button onClick={onBack} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg">
            Verify OTP & Reset
          </button>
        </div>
      )}
    </div>
  );
};

const RegisterScreen = ({ onRegister, onBack, isRegistering }) => {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', mobile: '',
    dob: '', sex: '', address1: '', address2: '', city: '',
    pin: '', state: '', country: 'India', agreedToTerms: false
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-6">
      <button onClick={onBack} className="self-start text-gray-500 mb-6">
        <ArrowRight className="transform rotate-180" /> Back
      </button>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Profile</h2>
      <p className="text-gray-500 mb-6">Complete all fields to join the community.</p>
      <form onSubmit={(e) => { e.preventDefault(); onRegister(formData); }} className="space-y-4 pb-10">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">First Name</label>
            <input required className="w-full p-3 rounded-xl border border-gray-200" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Last Name</label>
            <input required className="w-full p-3 rounded-xl border border-gray-200" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Email ID</label>
          <input type="email" required className="w-full p-3 rounded-xl border border-gray-200" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
          <input type="password" required className="w-full p-3 rounded-xl border border-gray-200" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
            <input required className="w-full p-3 rounded-xl border border-gray-200" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">State</label>
            <input required className="w-full p-3 rounded-xl border border-gray-200" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
          </div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-4">
          <div className="flex items-start gap-3">
            <input type="checkbox" id="terms" required checked={formData.agreedToTerms} onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })} className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
            <label htmlFor="terms" className="text-xs text-gray-600">
              I agree to the <span className="font-bold text-indigo-700">Terms of Service</span>.
            </label>
          </div>
        </div>
        <button type="submit" disabled={isRegistering || !formData.agreedToTerms} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-all mt-4 disabled:opacity-50">
          {isRegistering ? 'Registering...' : 'Complete Registration'}
        </button>
      </form>
    </div>
  );
};

// --- App Components ---

const NavBar = ({ currentView, setView }) => {
  const navItems = [
    { id: 'explore', icon: Home, label: 'Explore' },
    { id: 'my-items', icon: Package, label: 'My Items' },
    { id: 'post', icon: PlusCircle, label: 'Post' },
    { id: 'inbox', icon: MessageCircle, label: 'Inbox' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center z-50 safe-area-bottom">
      {navItems.map((item) => (
        <button key={item.id} onClick={() => setView(item.id)} className={`flex flex-col items-center justify-center w-full p-1 ${currentView === item.id ? 'text-indigo-600' : 'text-gray-400'}`}>
          <item.icon size={24} strokeWidth={currentView === item.id ? 2.5 : 2} />
          <span className="text-xs mt-1 font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

const ListingCard = ({ listing, onClick }) => (
  <div onClick={onClick} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4 active:scale-95 transition-transform cursor-pointer">
    <div className="h-48 bg-gray-200 relative">
      <div className={`w-full h-full bg-gradient-to-br ${listing.gradient || 'from-blue-100 to-indigo-100'} flex items-center justify-center text-gray-400`}>
        {listing.category === 'Electronics' && <span className="text-6xl">📱</span>}
        {listing.category === 'Stationery' && <span className="text-6xl">✏️</span>}
        {listing.category === 'Books' && <span className="text-6xl">📚</span>}
        {listing.category === 'Clothing' && <span className="text-6xl">👕</span>}
        {listing.category === 'Home' && <span className="text-6xl">🏠</span>}
        {!['Electronics', 'Stationery', 'Books', 'Clothing', 'Home'].includes(listing.category) && <span className="text-6xl">📦</span>}
      </div>
      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold text-indigo-800">{listing.category}</div>
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded-full text-xs font-bold text-white uppercase">{listing.type}</div>
      {listing.status === 'traded' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="bg-green-500 text-white px-4 py-2 rounded-full font-bold transform -rotate-12 border-2 border-white">TRADED</span>
        </div>
      )}
    </div>
    <div className="p-4">
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-gray-900 text-lg truncate flex-1">{listing.title}</h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md whitespace-nowrap ml-2">{listing.condition}</span>
      </div>
      <div className="flex items-center text-gray-500 text-sm mt-1 mb-3">
        <MapPin size={14} className="mr-1" />{listing.location} ({listing.city})
      </div>
      {listing.type === 'Barter' ? (
        <div className="bg-indigo-50 p-2 rounded-lg">
          <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-1">Looking For:</p>
          <p className="text-sm text-indigo-900 line-clamp-2">{listing.wants || 'Open to offers'}</p>
        </div>
      ) : (
        <div className="bg-green-50 p-2 rounded-lg">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wider mb-1">Giveaway</p>
          <p className="text-sm text-green-900">Free to claim</p>
        </div>
      )}
    </div>
  </div>
);

const MakeOfferModal = ({ targetListing, myListings, onClose, onSubmit }) => {
  const [selectedItemId, setSelectedItemId] = useState(null);
  const availableItems = myListings.filter((item) => item.status === 'active');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-lg">{targetListing.type === 'Giveaway' ? 'Claim Giveaway' : 'Make an Offer'}</h3>
          <button onClick={onClose}><XCircle className="text-gray-400" /></button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {targetListing.type === 'Giveaway' ? (
            <p className="text-gray-600 mb-4">You are claiming <span className="font-bold">{targetListing.title}</span>.</p>
          ) : (
            <p className="text-gray-600 mb-4">Offering on <span className="font-bold text-indigo-600">{targetListing.title}</span>. Select an item to trade:</p>
          )}
          {availableItems.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-dashed border-2 border-gray-200">
              <Package className="mx-auto text-gray-300 mb-2" size={32} />
              <p className="text-gray-500">You have no active items to trade.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableItems.map((item) => (
                <div key={item.id} onClick={() => setSelectedItemId(item.id)} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedItemId === item.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center text-lg">{item.category === 'Electronics' ? '📱' : '📦'}</div>
                  <div className="ml-3"><h4 className="font-medium text-gray-900">{item.title}</h4><p className="text-xs text-gray-500">{item.category}</p></div>
                  <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedItemId === item.id ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>{selectedItemId === item.id && <div className="w-2 h-2 bg-white rounded-full" />}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button disabled={!selectedItemId && targetListing.type !== 'Giveaway'} onClick={() => onSubmit(selectedItemId || 'claim')} className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${selectedItemId || targetListing.type === 'Giveaway' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed'}`}>
            {targetListing.type === 'Giveaway' ? 'Claim Item' : 'Send Barter Offer'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RateUserModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
      <h3 className="font-bold text-xl mb-2">Rate Experience</h3>
      <p className="text-gray-500 mb-4">How was your trade?</p>
      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="text-yellow-400 fill-yellow-400" size={32} />)}
      </div>
      <button onClick={onClose} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">Submit Review</button>
    </div>
  </div>
);

const ChatView = ({ offer, currentUser, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorTip, setAdvisorTip] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const scrollRef = useRef(null);
  const isMyListing = offer.ownerId === currentUser.uid;

  useEffect(() => {
    if (!offer) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), where('offerId', '==', offer.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      msgs.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [offer]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
      offerId: offer.id, senderId: currentUser.uid, text: newMessage, timestamp: serverTimestamp()
    });
    setNewMessage('');
  };

  const updateStatus = async (status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'offers', offer.id), { status });
    if (status === 'accepted') {
      setShowRating(true);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'listings', offer.listingId), { status: 'traded' });
      if (offer.offeredItemId !== 'claim') {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'listings', offer.offeredItemId), { status: 'traded' });
      }
    }
  };

  const askAdvisor = async () => {
    setAdvisorLoading(true);
    setAdvisorTip(null);
    const myItem = isMyListing ? offer.listingTitle : offer.offeredItemTitle;
    const theirItem = isMyListing ? offer.offeredItemTitle : offer.listingTitle;
    const prompt = `Barter Trade Advisor: I am trading "${myItem}" for "${theirItem}". Is it fair? 2 sentences.`;
    const response = await callGemini(prompt, false);
    setAdvisorTip(response || 'Advisor busy.');
    setAdvisorLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-slide-in-right">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center bg-white shadow-sm">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full"><ArrowRightLeft size={20} /></button>
        <div className="ml-3 flex-1"><h3 className="font-bold text-gray-800">Negotiation</h3><p className="text-xs text-gray-500">{isMyListing ? `With: ${offer.bidderName}` : 'With: Owner'}</p></div>
        <div className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full uppercase">{offer.status}</div>
      </div>
      <div className="bg-gray-50 p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 text-center"><div className="text-xs text-gray-500 mb-1">THEY GET</div><div className="font-bold text-gray-800 truncate px-2">{isMyListing ? offer.offeredItemTitle : offer.listingTitle}</div></div>
          <div className="px-2 text-gray-300"><Repeat size={20} /></div>
          <div className="flex-1 text-center"><div className="text-xs text-gray-500 mb-1">YOU GET</div><div className="font-bold text-gray-800 truncate px-2">{isMyListing ? offer.listingTitle : offer.offeredItemTitle}</div></div>
        </div>
        <div className="flex justify-center">
          {advisorTip ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-800 flex items-start w-full relative">
              <Bot className="flex-shrink-0 mr-2 text-indigo-500" size={18} />
              <p className="pr-4">{advisorTip}</p>
              <button onClick={() => setAdvisorTip(null)} className="absolute top-1 right-1 text-indigo-300 hover:text-indigo-600"><XCircle size={14} /></button>
            </div>
          ) : (
            <button onClick={askAdvisor} disabled={advisorLoading} className="flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors border border-indigo-100">
              {advisorLoading ? <span className="animate-pulse">Thinking...</span> : <><Sparkles size={14} className="mr-1" /> Analyze Fairness</>}
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.senderId === currentUser.uid ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>{msg.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="p-4 bg-white border-t border-gray-200 safe-area-bottom">
        {offer.status === 'pending' && isMyListing && (
          <div className="flex gap-3 mb-4">
            <button onClick={() => updateStatus('rejected')} className="flex-1 py-3 border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50">Decline</button>
            <button onClick={() => updateStatus('accepted')} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700">Accept Trade</button>
          </div>
        )}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-gray-100 border-0 rounded-xl px-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          <button type="submit" disabled={!newMessage.trim()} className="p-3 bg-indigo-600 text-white rounded-xl disabled:opacity-50 hover:bg-indigo-700"><Send size={20} /></button>
        </form>
      </div>
      {showRating && <RateUserModal onClose={() => { setShowRating(false); onClose(); }} />}
    </div>
  );
};

const InboxView = ({ incomingOffers, myOffers, setActiveOfferChat }) => {
  const [tab, setTab] = useState('incoming');
  
  const OfferItem = ({ offer, isIncoming }) => (
    <div onClick={() => setActiveOfferChat(offer)} className="bg-white p-4 rounded-xl border border-gray-100 mb-3 flex items-center justify-between shadow-sm active:scale-95 transition-transform cursor-pointer">
      <div>
        <h4 className="font-bold text-gray-900">{isIncoming ? offer.listingTitle : offer.offeredItemTitle}</h4>
        <p className="text-xs text-gray-500">
          {isIncoming ? `Offer from: ${offer.bidderName}` : `Your offer for: ${offer.listingTitle}`}
        </p>
      </div>
      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
        offer.status === 'accepted' ? 'bg-green-100 text-green-700' :
        offer.status === 'rejected' ? 'bg-red-100 text-red-700' :
        'bg-yellow-100 text-yellow-700'
      }`}>
        {offer.status}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex p-1 bg-gray-200 rounded-xl">
        <button onClick={() => setTab('incoming')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'incoming' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Received</button>
        <button onClick={() => setTab('sent')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'sent' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Sent</button>
      </div>
      <div>
        {tab === 'incoming' ? (
          incomingOffers.length === 0 ? <p className="text-gray-400 text-center py-8">No incoming offers yet.</p> : incomingOffers.map(o => <OfferItem key={o.id} offer={o} isIncoming={true} />)
        ) : (
          myOffers.length === 0 ? <p className="text-gray-400 text-center py-8">You haven't made any offers.</p> : myOffers.map(o => <OfferItem key={o.id} offer={o} isIncoming={false} />)
        )}
      </div>
    </div>
  );
};

const ProfileView = ({ userProfile, onSignOut }) => {
  if (!userProfile) return null;
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
        <div className="w-24 h-24 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center text-indigo-600 text-3xl font-bold">
          {userProfile.firstName?.[0]}{userProfile.lastName?.[0]}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{userProfile.fullName}</h2>
        <p className="text-gray-500">{userProfile.email}</p>
        <div className="flex justify-center gap-2 mt-2">
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center"><ShieldCheck size={12} className="mr-1"/> Verified</span>
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold flex items-center"><Star size={12} className="mr-1"/> 5.0</span>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center py-2 border-b border-gray-50">
          <span className="text-gray-600">City</span>
          <span className="font-medium">{userProfile.city}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-50">
           <span className="text-gray-600">Mobile</span>
           <span className="font-medium">{userProfile.mobile}</span>
        </div>
         <div className="flex justify-between items-center py-2">
           <span className="text-gray-600">Joined</span>
           <span className="font-medium">{userProfile.joinedAt ? new Date(userProfile.joinedAt.toDate()).toLocaleDateString() : 'Just now'}</span>
        </div>
      </div>

      <button onClick={onSignOut} className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors">
        <LogOut size={20} className="mr-2" /> Sign Out
      </button>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authView, setAuthView] = useState("welcome");
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [view, setView] = useState("explore");
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [incomingOffers, setIncomingOffers] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [makingOfferOn, setMakingOfferOn] = useState(null);
  const [activeOfferChat, setActiveOfferChat] = useState(null);
  const [isPostLoading, setIsPostLoading] = useState(false);
  const [isAiPolishing, setIsAiPolishing] = useState(false);
  const [newItem, setNewItem] = useState({
    title: "", category: "Electronics", type: "Barter", quantity: "1", condition: "Good",
    mfgDate: "", brand: "", country: "India", warranty: "0", wants: "", description: "", gradient: ""
  });

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const profileRef = doc(db, "artifacts", appId, "users", user.uid, "profile", "main");
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data());
          setAuthView("app");
        } else {
          setUserProfile(null);
          setAuthView("welcome");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAuthLoading(false);
      }
    };
    if (user) fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user || !userProfile || authView !== "app") return;
    const listingsQ = query(collection(db, "artifacts", appId, "public", "data", "listings"), where("status", "==", "active"));
    const unsubListings = onSnapshot(listingsQ, snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setListings(data.filter(item => item.userId !== user.uid));
      setMyListings(data.filter(item => item.userId === user.uid));
    });
    const inOffersQ = query(collection(db, "artifacts", appId, "public", "data", "offers"), where("ownerId", "==", user.uid));
    const unsubInOffers = onSnapshot(inOffersQ, snap => setIncomingOffers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const outOffersQ = query(collection(db, "artifacts", appId, "public", "data", "offers"), where("bidderId", "==", user.uid));
    const unsubOutOffers = onSnapshot(outOffersQ, snap => setMyOffers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubListings(); unsubInOffers(); unsubOutOffers(); };
  }, [user, userProfile, authView]);

  const handleRegister = async data => {
    if (!user) return;
    setIsRegistering(true);
    try {
      const fullName = `${data.firstName} ${data.lastName}`;
      await setDoc(doc(db, "artifacts", appId, "users", user.uid, "profile", "main"), {
        ...data, fullName, joinedAt: serverTimestamp(), termsAccepted: true
      });
      setUserProfile({ ...data, fullName, termsAccepted: true });
      setAuthView("app");
    } catch (err) { console.error("Reg failed", err); } finally { setIsRegistering(false); }
  };

  const handleLogin = (email, password) => {
    if (!email || !password) { alert("Please enter both email and password."); return; }
    if (userProfile && userProfile.email === email) { setAuthView("app"); }
    else {
      if (!userProfile) setUserProfile({ fullName: "Demo User", email, city: "Demo City", state: "Demo State", mobile: "0000000000", termsAccepted: true });
      setAuthView("app");
    }
  };

  const handleMagicPolish = async () => {
    if (!newItem.title && !newItem.description) return;
    setIsAiPolishing(true);
    const prompt = `Rewrite Listing. Title: ${newItem.title}. Desc: ${newItem.description}. Type: ${newItem.type}. Return JSON {title, description}.`;
    const result = await callGemini(prompt, true);
    if (result) setNewItem(prev => ({ ...prev, title: result.title || prev.title, description: result.description || prev.description }));
    setIsAiPolishing(false);
  };

  const handlePostItem = async e => {
    e.preventDefault();
    if (!user || !userProfile) return;
    setIsPostLoading(true);
    try {
      const gradients = ["from-blue-200 to-cyan-200", "from-purple-200 to-pink-200", "from-orange-200 to-amber-200", "from-emerald-200 to-teal-200"];
      const gradient = gradients[Math.floor(Math.random() * gradients.length)];
      await addDoc(collection(db, "artifacts", appId, "public", "data", "listings"), {
        userId: user.uid, userName: userProfile.fullName, location: userProfile.city || "", city: userProfile.city || "", state: userProfile.state || "",
        ...newItem, status: "active", createdAt: serverTimestamp(), gradient
      });
      setNewItem({ title: "", category: "Electronics", type: "Barter", quantity: "1", condition: "Good", mfgDate: "", brand: "", country: "India", warranty: "0", wants: "", description: "", gradient: "" });
      setView("my-items");
    } catch (err) { console.error(err); } finally { setIsPostLoading(false); }
  };

  const handleSubmitOffer = async offeredItemId => {
    if (!user || !makingOfferOn) return;
    const offeredItem = myListings.find(i => i.id === offeredItemId);
    try {
      await addDoc(collection(db, "artifacts", appId, "public", "data", "offers"), {
        listingId: makingOfferOn.id, listingTitle: makingOfferOn.title, ownerId: makingOfferOn.userId, bidderId: user.uid, bidderName: userProfile.fullName,
        offeredItemId, offeredItemTitle: offeredItem?.title || "Giveaway Claim", status: "pending", createdAt: serverTimestamp()
      });
      setMakingOfferOn(null);
      setView("inbox");
    } catch (err) { console.error(err); }
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center text-indigo-600 font-bold animate-pulse">Loading Barter...</div>;
  if (authView === "welcome") return <><style>{styles}</style><WelcomeScreen onStart={setAuthView} /></>;
  if (authView === "login") return <LoginScreen onLogin={handleLogin} onBack={() => setAuthView("welcome")} onForgot={() => setAuthView("forgot")} />;
  if (authView === "forgot") return <ForgotPasswordScreen onBack={() => setAuthView("login")} />;
  if (authView === "register") return <RegisterScreen onRegister={handleRegister} onBack={() => setAuthView("welcome")} isRegistering={isRegistering} />;

  return (
    <div className="bg-gray-50 min-h-screen pb-20 font-sans text-gray-900 selection:bg-indigo-100">
      <style>{styles}</style>
      <div className="bg-white sticky top-0 z-10 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center text-indigo-600 font-black text-xl tracking-tight"><ArrowRightLeft className="mr-2" strokeWidth={3} /> BARTER</div>
        <div className="flex gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600"><Search size={20} /></button>
          <button className="p-2 text-gray-400 hover:text-gray-600"><Filter size={20} /></button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-4">
        {view === "explore" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Discover</h2>
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button key={cat} className="px-4 py-2 bg-white rounded-full border border-gray-200 text-sm   
                  font-medium whitespace-nowrap hover:border-indigo-500 hover:text-indigo-600 transition-colors">{cat}</button>
                ))}
              </div>
            </div>
            <div>
              {listings.length === 0 ? <div className="text-center py-20 text-gray-400"><p>No listings found nearby.</p></div> : listings.map(item => <ListingCard key={item.id} listing={item} onClick={() => setMakingOfferOn(item)} />)}
            </div>
          </div>
        )}
        {view === "post" && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">List an Item</h2>
              <button type="button" onClick={handleMagicPolish} disabled={isAiPolishing || (!newItem.title && !newItem.description)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-bold rounded-full shadow-md transition-all disabled:opacity-50">
                {isAiPolishing ? <span className="animate-pulse">Polishing...</span> : <><Sparkles size={14} /> Magic Polish</>}
              </button>
            </div>
            <form onSubmit={handlePostItem} className="space-y-4">
              <input required placeholder="Item Title" className="w-full p-3 rounded-xl border border-gray-200" value={newItem.title} onChange={e => setNewItem({ ...newItem, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full p-3 rounded-xl border border-gray-200 bg-white" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select className="w-full p-3 rounded-xl border border-gray-200 bg-white" value={newItem.type} onChange={e => setNewItem({ ...newItem, type: e.target.value })}>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              </div>
              <textarea placeholder="Description" rows={3} className="w-full p-3 rounded-xl border border-gray-200" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
               {newItem.type === 'Barter' && (
                 <input placeholder="What do you want in return? (e.g. Books, Tools)" className="w-full p-3 rounded-xl border border-gray-200" value={newItem.wants} onChange={e => setNewItem({ ...newItem, wants: e.target.value })} />
               )}
              <div className="grid grid-cols-2 gap-4">
                 <select className="w-full p-3 rounded-xl border border-gray-200 bg-white" value={newItem.condition} onChange={e => setNewItem({ ...newItem, condition: e.target.value })}>{CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select>
                 <input placeholder="Brand (Optional)" className="w-full p-3 rounded-xl border border-gray-200" value={newItem.brand} onChange={e => setNewItem({ ...newItem, brand: e.target.value })} />
              </div>
              <button type="submit" disabled={isPostLoading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-all">{isPostLoading ? 'Posting...' : 'Post Listing'}</button>
            </form>
          </div>
        )}
        {view === "my-items" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">My Inventory</h2>
            {myListings.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                <Package className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-500">Empty.</p>
                <button onClick={() => setView("post")} className="mt-4 text-indigo-600 font-bold hover:underline">Start Listing</button>
              </div>
            ) : myListings.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
                <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center text-2xl`}>📦</div>
                <div className="ml-4 flex-1"><h3 className="font-bold text-gray-800">{item.title}</h3><p className="text-xs text-gray-500">{item.category} • {item.condition}</p></div>
                <div className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg uppercase">{item.status}</div>
              </div>
            ))}
          </div>
        )}
        {view === "inbox" && <InboxView incomingOffers={incomingOffers} myOffers={myOffers} setActiveOfferChat={setActiveOfferChat} />}
        {view === "profile" && <ProfileView userProfile={userProfile} onSignOut={() => { signOut(auth); setAuthView("welcome"); setUserProfile(null); }} />}
      </div>
      <NavBar currentView={view} setView={setView} />
      {makingOfferOn && <MakeOfferModal targetListing={makingOfferOn} myListings={myListings} onClose={() => setMakingOfferOn(null)} onSubmit={handleSubmitOffer} />}
      {activeOfferChat && <ChatView offer={activeOfferChat} currentUser={user} onClose={() => setActiveOfferChat(null)} />}
    </div>
  );
}