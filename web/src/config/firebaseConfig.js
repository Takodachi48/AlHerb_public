// Firebase Configuration for Herbal Medicine App
// Uses environment variables for security

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKey-ReplaceWithActualKey",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "herbal-medicine-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "herbal-medicine-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "herbal-medicine-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XXXXXXXXXX"
};

// For development, create a .env file in the web root with your Firebase credentials:
// VITE_FIREBASE_API_KEY=your_actual_api_key
// VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
// VITE_FIREBASE_PROJECT_ID=your-project-id
// VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
// VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
// VITE_FIREBASE_APP_ID=your_app_id
// VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
