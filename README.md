# 🤖 **Astra – Your Personal Desktop Voice Assistant**

Astra is a lightweight desktop voice assistant that helps you control your PC using natural speech. 
You can open apps, play music, search the web, run timers, and chat with it just like an AI companion.
It includes built-in speech recognition, TTS replies, smooth UI animations.
Designed to be simple and fast, Astra gives you an easy hands-free way to interact with you. 🌟

---

## ✨ **Features**

- 🎤 **Voice Commands** – Talk naturally to perform actions on your PC  
- 💬 **Chat Mode** – Ask questions and get intelligent AI responses   
- 🎙️ **Push-to-Talk** – Click a button and speak instantly  
- 🗣️ **Text-to-Speech Replies** – Astra talks back with clear, natural speech  
- ⚡ **Real-Time Intent Detection** – Automatically distinguishes between chat and commands  
- 🧠 **Action Execution** – Open apps, play media, set timers, control system tasks  
- ✨ **Smooth Animations** – Floating logo, fade-ins, typing dots & transitions  
- 🧪 **Live Logs Panel** – Real-time backend logs and classification outputs  
- 🎨 **Beautiful, Modern UI** – Clean, futuristic, glassmorphism design  
- 🌐 **Fast REST API** – Powered by Node.js + OpenAI GPT models  

---

## 🛠️ **Tech Stack**

### **Frontend (React)**
- ⚛️ **React** – Component-based UI framework  
- 🎨 **CSS3** – Custom gradients, glassmorphism effects  
- 🌀 **Framer Motion** – Smooth animations  
- 🎤 **Web Speech API** – Speech-to-Text (STT) & Text-to-Speech (TTS)  
- 🔔 **Web Audio API** – Custom beep sounds  

### **Backend (Node.js + Express)**
- 🚀 **Node.js** – JavaScript runtime  
- 🔌 **Express** – Web framework for REST APIs  
- 🤖 **OpenAI GPT** – Natural language understanding  
- 🎯 **Intent Classifier** – Distinguishes chat vs commands  
- 🧩 **Action Parser** – Converts speech to structured actions  
- ⚙️ **System Command Executor** – Runs desktop operations  
- 🔐 **dotenv** – Environment variable management  

---

##  **Architecture Diagram**






<img width="1441" height="1458" alt="Astra" src="https://github.com/user-attachments/assets/152e3913-2f00-48b9-ab2b-9ee3eba34946" />





---

## 📁 **Project Structure**

```
Astra/
├── backend/
│   ├── actions/       
│   ├── routes/
│   │   ├── chat.js            
│   │   ├── intent.js          
│   │   ├── parseAction.js     
│   │   └── executeAction.js   
│   ├── utils/
│   │   ├── classifyIntent.js  
│   │   ├── actionParser.js   
│   │   └── systemExec.js      
│   ├── .env                    
│   ├── server.js               
│   ├── package.json
│   └── package-lock.json
└── frontend/
    ├── public/
    ├── src/
    │   ├── App.js              
    │   ├── index.js            
    │   ├── api/
    │   │   ├── apiClient.js    
    │   │   ├── chat.js         
    │   │   ├── intent.js       
    │   │   ├── parseAction.js 
    │   │   └── executeAction.js 
    │   ├── utils/
    │   │   └── speech.js       
    │   ├── styles/   
    │   └── assets/
    │       └── beepSounds.js   
    ├── package.json
    ├── package-lock.json
    └── README.md
```

---

## 🚀 **Getting Started**

### ✅ **Prerequisites**
- 🟢 **Node.js** (v16 or higher)  
- 📦 **npm** or **yarn**  
- 🔑 **OpenAI API Key** – Get yours at [OpenAI Platform](https://platform.openai.com/)

---

### 📥 **Installation**

#### **1. Clone the Repository**
```bash
git clone https://github.com/yourusername/astra-voice-assistant.git
cd astra-voice-assistant
```

#### **2. Backend Setup**

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
```

Start the backend server:
```bash
npm start
```

Backend will run at: **http://localhost:3001**

---

#### **3. Frontend Setup**

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory:
```env
REACT_APP_BACKEND_URL=http://localhost:3001
```

Start the frontend:
```bash
npm start
```

Frontend will open at: **http://localhost:3000**

---

## 📖 **Usage**

### 🎤 **Voice Commands**
1. Click the **Mic button** and speak your command
2. Or say **"Hey Astra"** for hands-free hotword activation
3. Astra will process your request and respond with voice + actions

### 💬 **Chat Mode**
Ask Astra anything like a conversational AI:
- *"What is the capital of Japan?"*
- *"Tell me a joke"*
- *"Explain quantum physics"*
- *"Write a poem about nature"*

### 🧪 **Live Logs**
- Check the **right sidebar** to see:
  - API responses
  - Intent classification (chat vs command)
  - Parsed actions
  - Execution results

---

## 🌐 **API Endpoints**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/intent` | POST | Detects if message is chat or command |
| `/api/chat` | POST | Sends chat messages to OpenAI |
| `/api/parseAction` | POST | Converts natural language → structured action |
| `/api/executeAction` | POST | Executes system-level actions |

---

## 🎯 **How It Works**

1. **Speech Input** – User speaks via microphone or hotword  
2. **Intent Classification** – Backend determines: Chat or Command?  
3. **Processing**:
   - **Chat** → Sends to OpenAI for conversational response  
   - **Command** → Parses action and executes system operation  
4. **Text-to-Speech** – Astra speaks the response  
5. **Visual Feedback** – UI animations, logs, and status updates  

---

## 📧 **Contact**

For questions or support, please open an issue on GitHub.

---

**Made with ❤️**

*Astra – Bringing the future of voice computing* 🚀
