# AlgoHerbarium: From Leaf to Remedy

Philippine Herbal medicine system

## Features

- **Herb Database**: Extensive database of medicinal herbs with detailed information
- **Herbal Recommendations**: Herbal remedy recommendations based on 
- **Herb Comparison**: Compare herbs to determine which is best for a specific symptom
- **Herb Safety**: Check if a herb is safe based on the users demographic and medications
- **Herb Interaction**: Check the interactions and contraindications of herbs with other herbs or pharmaceutical medications
- **Plant Identification**: Upload images for plant identification
- **Interactive Maps**: Find herbal locations and near you
- **Blog System**: Educational content about herbal medicine
- **Admin Dashboard**: Manage and moniter the system

## ⚠️ Known Issues

**Analytics Exports**: The export functionality for analytics data (CSV/PDF) is currently not working properly.

**ML Retraining**: Model retraining features for both image classifier and recommendation engine are not functional.

**ML Recommendations**: Actual machine learning recommendations are not implemented. The system currently uses heuristic-based recommendations through database matching.

**Real-time Analytics**: Real-time data updates in the operations tab are not working in the deployed application, though they function properly in local development.

**Cloudflare Protection**: The Cloudflare protection feature is not properly implemented for mobile applications. When enabled by admins, users cannot log in through the mobile app.

## Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (local or cloud instance)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/herb.git
   cd herb
   ```

2. **Install dependencies**
   
   **Web, Server & Mobile Setup:**
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Install web dependencies
   cd ../web
   npm install
   
   # Install mobile dependencies
   cd ../mobile
   npm install
   
   # Install Expo CLI globally (if not already installed)
   npm install -g @expo/cli
   ```
   
   **ML Services Setup:**
   ```bash
   # Image Classifier Setup
   cd ml-services/image-classifier
   
   # Create virtual environment (if not exists)
   python -m venv .venv
   
   # Activate virtual environment
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   
   # Install requirements
   pip install -r requirements.txt
   
   # Recommendation Engine Setup
   cd ../recommendation-engine
   
   # Create virtual environment (if not exists)
   python -m venv .venv
   
   # Activate virtual environment
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   
   # Install requirements
   pip install -r requirements.txt
   ```

3. **Environment Setup**
   
   Create environment files in both `web`, `server`, and `mobile` directories:
   
   **Server Environment** (`server/.env`):
   See: server/.env.example
   
   **Web Environment** (`web/.env`):
   See: web/.env.example

   **Mobile Environment** (`mobile/.env`)
   See: mobile/.env.example

4. **Start Application**
   
   **Option 1 - Using VS Code Tasks (Recommended)**
   Press `Ctrl + Shift + P`
   Search for: `Tasks: Run Task`
   Select: `Start Full Stack (Local)`

   This will start all services simultaneously:
   - Web server (port 3000)
   - API server (port 5000)
   - Image classifier (port 8000)
   - Recommendation engine (port 8001)

   **Option 2 - Manual Startup**
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

   **Option 3 - Start Web & Server Only**
   If you don't need ML services:
   ```bash
   # VS Code Task: "Start Web & Server Only"
   # Or manually start just the web and server terminals
   ```

5. **Access Application**
   
   - **Web Application**: http://localhost:3000
   - **API Server**: http://localhost:5000
   - **API Documentation**: http://localhost:5000/api-docs
   - **Admin Dashboard**: http://localhost:3000/admin/dashboard
   - **Mobile App**: Scan QR code from Expo terminal or use Expo Go app with URL: `exp://<your-ip>:19000`

6. **Stopping Services**
   
   **Using VS Code Tasks:**
   Press `Ctrl + Shift + P`
   Search for: `Tasks: Run Task`
   Select: `Stop Full Stack (Local)`
   
   **Manual Stop:**
   Use `Ctrl + C` in each terminal, or use the provided stop tasks:
   - `Stop Web & Server Only`
   - `Stop Full Stack (Local)`

## 📁 Project Structure

```
herb/
├── web/                    # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── styles/        # Global styles and themes
│   │   ├── hooks/         # Custom React hooks
│   │   ├── context/       # React context providers
│   │   └── services/      # API service functions
│   ├── public/            # Static assets
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── models/        # Database models
│   │   ├── middleware/    # Express middleware
│   │   ├── controllers/   # Route controllers
│   │   └── utils/         # Utility functions
│   ├── uploads/           # File upload directory
│   └── package.json
├── shared/                # Shared constants and types
│   └── constants/
└── README.md
```

## Deployment

### Public vs Internal Exposure
- Public internet: `herb-server` (`5000`) and ML services (`8000`, `8001`) when deployed as separate Hugging Face Spaces.
- Protected internal routes:
  - `server /internal/*`: internal key is always required, IP check can be disabled for cross-Space traffic.
  - `recommendation-engine /score` and `/retrain`: internal key is always required, IP check can be disabled for cross-Space traffic.
  - `image-classifier /api/v1/classify-image` and `/api/v1/feedback`: internal key is always required, IP check can be disabled for cross-Space traffic.

### Production Environment (Required)
Set these in `server/.env`:
- `NODE_ENV=production`
- `MONGODB_URI=<mongodb uri>`
- `JWT_SECRET=<32+ chars>`
- `INTERNAL_API_KEY=<32+ chars>`
- `ALLOWED_ORIGINS=https://your-web-domain`
- `IMAGE_CLASSIFIER_URL=https://<image-classifier-space>.hf.space`
- `RECOMMENDATION_ENGINE_URL=https://<recommendation-engine-space>.hf.space`

Optional:
- `TRUST_PROXY=true` when behind a reverse proxy/load balancer.
- `INTERNAL_ENFORCE_ORIGIN=false` when ML services call `/internal/*` from external networks.
- `REDIS_REQUIRED=true` and `REDIS_URL=<managed redis url>` if Redis is part of readiness.

Set these in `web/.env`:
- `VITE_API_BASE_URL=https://your-api-domain/api`

Set these in `ml-services/recommendation-engine/.env`:
- `MAIN_API_URL=https://<server-space>.hf.space`
- `INTERNAL_API_KEY=<same 32+ char key>`
- `ALLOW_EXTERNAL_INTERNAL_CALLS=true`

Set these in `ml-services/image-classifier/.env`:
- `MAIN_API_URL=https://<server-space>.hf.space`
- `INTERNAL_API_KEY=<same 32+ char key>`
- `ALLOW_EXTERNAL_INTERNAL_CALLS=true`
- `REDIS_URL=<managed redis url>`

### Health Endpoints
- `GET /health`: liveness (process is up).
- `GET /ready`: readiness (DB + ML dependencies, plus Redis if required).

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [React](https://reactjs.org/) - Frontend framework
- [Node.js](https://nodejs.org/) - Backend runtime
- [MongoDB](https://www.mongodb.com/) - Database
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Framer Motion](https://www.framer.com/motion/) - Animation library
