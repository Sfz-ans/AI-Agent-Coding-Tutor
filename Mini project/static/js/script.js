// ====================== MAIN DOM NODES ===========================
const chat = document.getElementById("chat");
const input = document.getElementById("userInput");
const btn = document.getElementById("sendBtn");
let typingDiv = null; // global variable

// Firebase config (keep your keys here)
const firebaseConfig = {
  apiKey: "AIzaSyBj90NjnxdXzKE3KtDOh5Q-NrJ5VOX-YRc",
  authDomain: "ai-coding-tutor-8aa2d.firebaseapp.com",
  projectId: "ai-coding-tutor-8aa2d",
  storageBucket: "ai-coding-tutor-8aa2d.firebasestorage.app",
  messagingSenderId: "80480466801",
  appId: "1:80480466801:web:7bb7fa34617afec16ca8d0",
  measurementId: "G-50LVJDQNER"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let userId = null;
let activeChatId = null; // track current chat thread

// ====================== AUTH ELEMENTS ===========================
const authContainer = document.getElementById("authContainer");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const deleteBtn = document.getElementById("deleteBtn");
const authError = document.getElementById("authError");

// ====================== UI ELEMENTS ===========================
const profileBtn = document.getElementById("profileBtn");
const profileMenu = document.getElementById("profileMenu");
const usernameDisplay = document.getElementById("usernameDisplay");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const sidebar = document.getElementById("sidebar");
const chatList = document.getElementById("chatList");
const newChatBtn = document.getElementById("newChatBtn");

// ====================== AUTH FUNCTIONS ===========================
loginBtn.addEventListener("click", () => authUser("login"));
signupBtn.addEventListener("click", () => authUser("signup"));
logoutBtn.addEventListener("click", logoutUser);
deleteBtn.addEventListener("click", deleteUser);

async function authUser(mode) {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    authError.textContent = "All fields required";
    return;
  }

  const userDocRef = db.collection("users").doc(username);

  try {
    const doc = await userDocRef.get();

    if (mode === "signup") {
      if (doc.exists) {
        authError.textContent = "Username already taken!";
        return;
      }
      await userDocRef.set({ password });
    } else {
      if (!doc.exists) {
        authError.textContent = "User not found!";
        return;
      }
      const storedPassword = doc.data().password;
      if (storedPassword !== password) {
        authError.textContent = "Incorrect password!";
        return;
      }
    }

    // success: set logged in state
    userId = username;
    localStorage.setItem("userId", userId);
    usernameDisplay.textContent = userId;
    authContainer.style.display = "none";

    await loadChatList();
    await loadChatHistory();

  } catch (err) {
    authError.textContent = "Error: " + err.message;
  }
}

function logoutUser() {
  userId = null;
  localStorage.removeItem("userId");
  authContainer.style.display = "flex";
  chat.innerHTML = "";
  usernameDisplay.textContent = "User";
}

async function deleteUser() {
  if (!userId) return;
  const confirmDelete = confirm("Are you sure you want to delete your account? All your chats will be lost.");
  if (!confirmDelete) return;

  try {
    const userRef = db.collection("users").doc(userId);
    const chatsSnapshot = await userRef.collection("chats").get();
    const batch = db.batch();

    chatsSnapshot.forEach(doc => batch.delete(doc.ref));
    batch.delete(userRef);
    await batch.commit();

    logoutUser();
    alert("Account deleted successfully.");
  } catch (err) {
    alert("Error deleting account: " + err.message);
  }
}

btn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

async function sendMessage() {
  const userMsg = input.value.trim();
  if (!userMsg || !userId) return;

  // Append user message
  chat.innerHTML += `<div class='text-right'><p class='bg-cyan-600 inline-block p-3 rounded-lg my-2'>${escapeHtml(userMsg)}</p></div>`;
  input.value = '';
  chat.scrollTop = chat.scrollHeight;

  // Remove existing typing bubble if any
  

  try {
    const response = await fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: userMsg, user_id: userId })

      
    });

    const data = await response.json();
    const aiAnswer = data.answer || "No answer";

    // Remove typing bubble


    // Append AI answer
    chat.innerHTML += `<p>${aiAnswer}</p>`;
    chat.scrollTop = chat.scrollHeight;

    // Save to Firestore
    const chatDocRef = db.collection("users").doc(userId).collection("chats");
    if (!activeChatId) {
      const newDoc = await chatDocRef.add({
        question: userMsg,
        answer: aiAnswer,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      activeChatId = newDoc.id;
    } else {
      await chatDocRef.doc(activeChatId).set(
        {
          question: userMsg,
          answer: aiAnswer,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    await loadChatList();

  } catch (err) {
    chat.innerHTML += `<div class='text-left'><p class='bg-red-600 inline-block p-3 rounded-lg my-2'>Error: ${escapeHtml(err.message || err)}</p></div>`;
    chat.scrollTop = chat.scrollHeight;
  }
}


function escapeHtml(unsafe) {
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ====================== LOAD CHAT HISTORY ===========================
async function loadChatHistory() {
  if (!userId) return;

  chat.innerHTML = "";

  const snapshot = await db.collection("users")
    .doc(userId)
    .collection("chats")
    .orderBy("timestamp", "asc")
    .get();

  snapshot.forEach(doc => {
    const { question, answer } = doc.data();
    chat.innerHTML += `
      <div class='text-right'><p class='bg-cyan-600 inline-block p-3 rounded-lg my-2'>${escapeHtml(question)}</p></div>
      <div class='text-left'><p class='bg-gray-700 inline-block p-3 rounded-lg my-2'>${answer}</p></div>`;
  });

  chat.scrollTop = chat.scrollHeight;
}

// ====================== LOAD CHAT LIST (sidebar) ===========================
async function loadChatList() {
  if (!userId) return;

  const snapshot = await db.collection("users")
    .doc(userId)
    .collection("chats")
    .orderBy("timestamp", "desc")
    .get();

  chatList.innerHTML = "";
  let index = 1;

  snapshot.forEach(doc => {
    const data = doc.data() || {};
    const question = data.question || "Untitled";
    const shortText = question.length > 30 ? question.substring(0, 30) + "..." : question;
    const li = document.createElement("li");
    li.className = "p-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer";
    li.textContent = `${index}. ${shortText}`;
    li.addEventListener("click", async () => {
      activeChatId = doc.id;
      chat.innerHTML = "";
      const docRef = await db.collection("users").doc(userId).collection("chats").doc(doc.id).get();
      const d = docRef.data() || {};
      chat.innerHTML = `
        <div class='text-right'><p class='bg-cyan-600 inline-block p-3 rounded-lg my-2'>${escapeHtml(d.question || "")}</p></div>
        <div class='text-left'><p class='bg-gray-700 inline-block p-3 rounded-lg my-2'>${d.answer || ""}</p></div>`;
    });
    chatList.appendChild(li);
    index++;
  });
}

// ====================== NEW CHAT BUTTON ===========================
newChatBtn.addEventListener("click", async () => {
  if (!userId) return;

  chat.innerHTML = "";
  activeChatId = null;

  // create placeholder in Firestore
  const newDoc = await db.collection("users").doc(userId).collection("chats").add({
    question: "New Chat Started",
    answer: "",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  activeChatId = newDoc.id;

  await loadChatList();
});

// ====================== PROFILE & SIDEBAR ===========================
profileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  profileMenu.classList.toggle("hidden");
});

// Sidebar visible by default
sidebar.classList.remove("hidden");
openSidebar.classList.add("hidden");

openSidebar.addEventListener("click", () => {
  sidebar.classList.remove("hidden");
  openSidebar.classList.add("hidden");
});

closeSidebar.addEventListener("click", () => {
  sidebar.classList.add("hidden");
  openSidebar.classList.remove("hidden");
});

window.addEventListener("click", (e) => {
  if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
    profileMenu.classList.add("hidden");
  }
});

// ====================== INITIAL LOAD ===========================
window.addEventListener("DOMContentLoaded", async () => {
  const savedUser = localStorage.getItem("userId");
  if (savedUser) {
    userId = savedUser;
    usernameDisplay.textContent = userId;
    authContainer.style.display = "none";
    await loadChatList();
    await loadChatHistory();
  } else {
    authContainer.style.display = "flex";
  }
});

