/* Firebase bootstrap (v12) — attaches app/auth/db to window.FB for non-module scripts */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, serverTimestamp, getDocs, query, orderBy, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

/* ⚠️ Your config */
const firebaseConfig = {
  apiKey: "AIzaSyAJ9ARgNbyEgTZ_E-4XJHgdzoC9WucZsCM",
  authDomain: "mc-proposal.firebaseapp.com",
  projectId: "mc-proposal",
  storageBucket: "mc-proposal.firebasestorage.app",
  messagingSenderId: "691069090577",
  appId: "1:691069090577:web:c5fc45fedaa4150f936ab0"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

window.FB = {
  app, auth, db,
  api: {
    onAuthStateChanged, signInWithEmailAndPassword, signOut,
    doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
    collection, serverTimestamp, getDocs, query, orderBy, where, onSnapshot
  }
};
window.FBReady = Promise.resolve(true);
