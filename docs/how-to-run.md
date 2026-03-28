# How to Run AlgoHerbarium

This guide will help you set up and run the AlgoHerbarium application locally for development.

## � Recommended Approach

**It's highly recommended to open this project in VS Code** to use the built-in tasks that can start all services with one command. This is the easiest way to get everything running simultaneously.

## �📝 Important Note for Deployed Services

When using the **deployed web app** (algoherbarium.vercel.app), the cloud services may enter a "cold start" state due to inactivity. To ensure full functionality:

1. **Wake up the services** by accessing algoherbarium.vercel.app
2. **Wait 2-3 minutes** for all services to initialize
3. **Login to the application** to authenticate sessions
4. **Upload an image** to the image classifier to wake up the ML service
5. **Wait an additional 2-3 minutes** for full service readiness

This "warming up" process is necessary because:
- The server and ML services auto-pause when inactive on Hugging Face Spaces
- Image classification service needs extra time to load models
- Database connections need time to establish

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB Atlas** (cloud instance) or local MongoDB
- **Python 3+** (for ML services)
- **Git**
- **Expo Go** app (for mobile development)

## Quick Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd algoherbarium
```

---

## 🚀 Quick Start (If you have all dependencies)

**If you already have Node.js, Python, and all prerequisites installed**, you can start the application immediately:

1. **Configure your environment files** (see Environment Setup section below)
2. **Skip to "Starting the Application" section**
3. **Run your preferred startup option**

---

## Environment Setup

Create environment files in the required directories:

#### Server Environment (`server/.env`)
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here-32-chars-minimum
INTERNAL_API_KEY=your-internal-api-key-here-32-chars-minimum
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006
IMAGE_CLASSIFIER_URL=http://localhost:8000
RECOMMENDATION_ENGINE_URL=http://localhost:8001
```

#### Web Environment (`web/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=AlgoHerbarium
```

#### Mobile Environment (`mobile/.env`)
```env
EXPO_API_BASE_URL=http://localhost:5000/api
# For mobile development, you may need to update the API base URL to use your machine's IP address or configure ngrok if the connection is blocked:
# EXPO_API_BASE_URL=http://<your-ip>:5000/api
# Or use ngrok if network issues occur
# EXPO_API_BASE_URL=https://<ngrok-url>.ngrok.io/api
```

#### ML Services Environment

**Image Classifier** (`ml-services/image-classifier/.env`):
```env
MAIN_API_URL=http://localhost:5000
INTERNAL_API_KEY=your-internal-api-key-here-32-chars-minimum
ALLOW_EXTERNAL_INTERNAL_CALLS=true
```

**Recommendation Engine** (`ml-services/recommendation-engine/.env`):
```env
MAIN_API_URL=http://localhost:5000
INTERNAL_API_KEY=your-internal-api-key-here-32-chars-minimum
ALLOW_EXTERNAL_INTERNAL_CALLS=true
```

---

## Starting the Application

### Option 1: Using VS Code Tasks (Recommended)

1. Open the project in VS Code
2. Press `Ctrl + Shift + P`
3. Search for: `Tasks: Run Task`
4. Select: `Start Full Stack (Local)`

This will start all services simultaneously:
- Web server (port 3000)
- API server (port 5000)
- Image classifier (port 8000)
- Recommendation engine (port 8001)

### Option 2: Manual Startup

Open separate terminals for each service:

```bash
# Terminal 1 - Start API server
cd server
npm run dev

# Terminal 2 - Start web client
cd web
npm run dev

# Terminal 3 - Start image classifier
cd ml-services/image-classifier
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 4 - Start recommendation engine
cd ml-services/recommendation-engine
.venv\Scripts\python.exe src/main.py

# Terminal 5 - Start mobile client (optional)
cd mobile
npx expo start --tunnel
```

### Option 3: Start Web & Server Only

If you don't need ML services:

```bash
# VS Code Task: "Start Web & Server Only"
# Or manually start just the web and server terminals
```

## Access the Application

Once running, you can access:

- **Web Application**: http://localhost:3000
- **API Server**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api-docs
- **Admin Dashboard**: http://localhost:3000/admin/dashboard
- **Mobile App**: Scan QR code from Expo terminal or use Expo Go app with URL: `exp://<your-ip>:19000`

## Stopping Services

### Using VS Code Tasks

1. Press `Ctrl + Shift + P`
2. Search for: `Tasks: Run Task`
3. Select: `Stop Full Stack (Local)`

### Manual Stop

Use `Ctrl + C` in each terminal, or use the provided stop tasks:
- `Stop Web & Server Only`
- `Stop Full Stack (Local)`

## Troubleshooting

### Common Issues

**Port Already in Use**
- Run the stop tasks to clear ports
- Or manually kill processes on ports 3000, 5000, 8000, 8001

**MongoDB Atlas Connection Failed**
- Ensure your MongoDB Atlas cluster is running
- Check that your IP address is whitelisted in Atlas Network Access
- Verify the MONGODB_URI format: `mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority`
- Ensure database user has proper permissions

**Python Environment Issues**
- Ensure virtual environment is activated
- Verify Python version is 3.9+

**Mobile Development Issues**
- Ensure Expo Go is installed on your device
- Check that your device and development machine are on the same network

### Health Check Endpoints

- Server Health: `GET http://localhost:5000/health`
- Server Readiness: `GET http://localhost:5000/ready`
- Image Classifier Health: `GET http://localhost:8000/health`
- Recommendation Engine Health: `GET http://localhost:8001/health`

## Development Tips

1. **Hot Reload**: All services support hot reload during development
2. **Logs**: Check terminal outputs for service logs and errors
3. **Database**: Use MongoDB Compass to inspect the local database
4. **API Testing**: Use the built-in API docs at `/api-docs` for testing endpoints

## Next Steps

After setup:
1. Explore the web application at http://localhost:3000
2. Check out the API documentation
3. Review the project structure in the main README
4. Start developing your features!