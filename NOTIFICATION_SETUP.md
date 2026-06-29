# Notification System Setup Guide

## Database Migration

Run the notification schema migration to create the required tables:

```bash
cd backend
psql -U [your_username] -d [your_database] -f migrations/002_notifications_schema.sql
```

Or using Supabase SQL Editor:
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `migrations/002_notifications_schema.sql`
4. Execute the SQL

## Tables Created

1. **notifications** - Stores notification details
   - id, title, message, type, created_by, created_at, updated_at
   - scheduled_for, meeting_link, priority

2. **notification_recipients** - Tracks notification delivery to users
   - id, notification_id, user_id, is_read, read_at, created_at

## API Endpoints

### Create Notification (Admin/Team Leader only)
```
POST /api/v1/notifications
Authorization: Bearer <token>

Body:
{
  "title": "Team Meeting",
  "message": "Weekly sync meeting at 3 PM",
  "type": "meeting",
  "recipient_ids": ["user-uuid-1", "user-uuid-2"],
  "priority": "high",
  "meeting_link": "https://meet.google.com/xxx",
  "scheduled_for": "2024-12-20T15:00:00Z"
}
```

### Get User Notifications
```
GET /api/v1/notifications?limit=20
Authorization: Bearer <token>
```

### Get Unread Count
```
GET /api/v1/notifications/unread/count
Authorization: Bearer <token>
```

### Mark as Read
```
PUT /api/v1/notifications/:id/read
Authorization: Bearer <token>
```

### Mark All as Read
```
PUT /api/v1/notifications/read-all
Authorization: Bearer <token>
```

### Delete Notification
```
DELETE /api/v1/notifications/:id
Authorization: Bearer <token>
```

## Features

✅ Bell icon with unread count badge in header
✅ Real-time notifications via Socket.IO
✅ Dropdown panel showing recent notifications
✅ Color-coded by priority (urgent/high/normal/low)
✅ Support for different notification types (meeting/announcement/reminder/task/general)
✅ Meeting links for meeting notifications
✅ Mark as read/unread functionality
✅ Create notification modal for Admin/Team Leader
✅ Role-based access control

## Testing

1. Login as Admin or Team Leader
2. Click "Create Notification" button (if available on notifications page)
3. Fill in notification details and select recipients
4. Assigned users will see the bell icon update with unread count
5. Click bell icon to view notifications
6. Click notification to mark as read

## Socket.IO Events

- `notification:new` - Sent to recipient when new notification created
- `notification:marked-read` - Broadcast when notification marked as read
- `notification:all-marked-read` - Broadcast when all marked as read
- `notification:send` - Emit to send notification to recipients
- `notification:read` - Emit to mark notification as read
- `notification:read-all` - Emit to mark all as read
