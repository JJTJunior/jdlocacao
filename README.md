<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e71b1325-b3b5-40b2-9f1a-cdf069ac8371

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the environment variables in a `.env` file (see `.env.example` and the Vercel section below).
3. Run the app:
   `npm run dev`

## Deploy to Vercel

To deploy this project to Vercel, follow these steps:

1. **Import the project** into your Vercel account.
2. **Configure Environment Variables**:
   In the Vercel project settings, add the following variables:
   - `VITE_SUPABASE_URL`: Your Supabase API URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anonymous Key.
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
3. **Build Settings**:
   - Framework Preset: `Vite` (automatically detected).
   - Build Command: `npm run build`.
   - Output Directory: `dist`.
4. **Deploy**: Click deploy and wait for the process to complete.

The project includes a `vercel.json` file to handle SPA routing automatically.
