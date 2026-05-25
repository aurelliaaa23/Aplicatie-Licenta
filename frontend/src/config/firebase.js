import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // 1. Am adăugat importul pentru Auth

const firebaseConfig = {
  apiKey: "AIzaSyC1hxKbSbDnRUSFfPlx06zlToaZy7QmaQk",
  authDomain: "dgaspc-app.firebaseapp.com",
  projectId: "dgaspc-app",
  storageBucket: "dgaspc-app.firebasestorage.app",
  messagingSenderId: "1027594633538",
  appId: "1:1027594633538:web:874c9f4d7521a60094c8db",
  measurementId: "G-HP3M9BF882"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 2. Inițializăm și exportăm "auth" pentru a putea fi folosit în Register.jsx
export const auth = getAuth(app);