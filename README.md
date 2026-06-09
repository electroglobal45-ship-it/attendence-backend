# Attendance & Task Management Backend

Express.js backend with Supabase for attendance tracking and task management.

## 🚀 Quick Start

### 1. Setup Temp Database

We're using a **temporary Supabase database** for development. Follow these steps:

```bash
# Run the setup helper
setup-temp-db.bat
```

Or manually:
1. Create a new Supabase project (temp/dev)
2. Copy credentials to `.env`
3. Run `DATABASE_MIGRATION.sql` in Supabase SQL Editor
4. Create storage buckets: `selfies`, `task-attachments`

📖 **See `TEMP_DATABASE_SETUP.md` for detailed instructions**

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

Server will start on: http://localhost:5000

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Authentication
```
POST   /api/v1/auth/login           # Login with email/password
GET    /api/v1/auth/me              # Get current user profile
POST   /api/v1/auth/change-password # Change password
POST   /api/v1/auth/logout          # Logout
```

### Attendance
```
GET    /api/v1/attendance/today     # Get today's attendance
POST   /api/v1/attendance/mark      # Mark attendance (check-in)
POST   /api/v1/attendance/markout   # Mark out (check-out)
GET    /api/v1/attendance/history   # Get attendance history
```

## 🧪 Testing the API

### 1. Test Health Check
```bash
curl http://localhost:5000/health
```

### 2. Test Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "admin123"
  }'
```

### 3. Test Attendance (with token)
```bash
curl http://localhost:5000/api/v1/attendance/today \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── supabase.ts              # Supabase client setup
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT validation
│   │   ├── error.middleware.ts      # Error handling
│   │   └── validation.middleware.ts # Request validation
│   ├── modules/
│   │   ├── auth/                    # Authentication module
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.routes.ts
│   │   └── attendance/              # Attendance module
│   │       ├── attendance.service.ts
│   │       ├── attendance.controller.ts
│   │       └── attendance.routes.ts
│   ├── utils/
│   │   ├── response.ts              # Standard API responses
│   │   ├── date.ts                  # Date utilities (IST)
│   │   └── storage.ts               # Supabase Storage helpers
│   ├── types/
│   │   └── index.ts                 # TypeScript types
│   ├── app.ts                       # Express app setup
│   └── server.ts                    # Server entry point
├── .env                             # Environment variables
├── DATABASE_MIGRATION.sql           # Database schema
├── TEMP_DATABASE_SETUP.md           # Setup guide
└── package.json
```

## 🔐 Authentication Flow

1. **Frontend** calls `/api/v1/auth/login` with email/password
2. **Backend** verifies credentials against `users` table
3. **Backend** signs in with Supabase Auth
4. **Backend** returns access token
5. **Frontend** stores token and sends in `Authorization: Bearer <token>` header
6. **Backend** validates token using Supabase Auth

## 📤 File Upload Flow

1. **Frontend** captures selfie/file
2. **Frontend** converts to base64
3. **Frontend** sends base64 in request body
4. **Backend** uploads to Supabase Storage
5. **Backend** returns public URL

## 🛠️ Tech Stack

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Supabase** - Database + Auth + Storage
- **Zod** - Input validation
- **Morgan** - HTTP logging
- **Helmet** - Security headers
- **CORS** - Cross-origin requests

## 📊 Database Tables

- `users` - User accounts
- `office_locations` - Office GPS coordinates
- `holidays` - Holiday calendar
- `working_day_opt_ins` - Weekend/holiday work requests
- `attendance` - Daily attendance records
- `leaves` - Leave requests
- `short_leaves` - Short leave requests
- `projects` - Projects
- `boards` - Kanban boards
- `lists` - Board columns
- `tasks` - Task cards
- `task_comments` - Task comments
- `task_attachments` - Task files
- `labels` - Task labels
- `checklists` - Task checklists
- `checklist_items` - Checklist items

## 🔄 Migration to Production

When ready to move to production:

1. Export data from temp database
2. Create production Supabase project
3. Run `DATABASE_MIGRATION.sql` on production
4. Import data to production
5. Update `.env` with production credentials
6. Test thoroughly
7. Deploy!

## 📝 Environment Variables

```env
NODE_ENV=development
PORT=5000
API_VERSION=v1

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf
```

## 🐛 Troubleshooting

### Server won't start
- Check if `.env` file exists
- Verify Supabase credentials are correct
- Make sure port 5000 is not in use

### Database connection error
- Verify Supabase project is active
- Check if migration was run successfully
- Confirm service_role key is correct

### File upload fails
- Check if storage buckets exist
- Verify buckets are set to public
- Check file size limits

## 📚 Next Steps

- [ ] Setup temp database
- [ ] Test auth endpoints
- [ ] Test attendance endpoints
- [ ] Build task management module
- [ ] Build employee management module
- [ ] Build reports module
- [ ] Migrate to production

## 🆘 Need Help?

Check these files:
- `TEMP_DATABASE_SETUP.md` - Database setup guide
- `DATABASE_MIGRATION.sql` - Database schema
- `SIMPLIFIED_BACKEND_STACK.md` - Architecture decisions

---

**Status**: ✅ Auth & Attendance modules complete and ready to test!
