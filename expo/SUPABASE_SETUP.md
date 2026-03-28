# Supabase Integration Setup

This app now includes Supabase authentication with email/password and Google OAuth, plus data hooks for fitness tracking.

## 1. Environment Variables

Create a `.env` file in the project root with:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Get these values from your Supabase project dashboard: Settings → API

## 2. Supabase Configuration

### Authentication Setup

**CRITICAL: Email Confirmation Settings**

For testing/development, you need to disable email confirmation:

1. Go to Supabase Dashboard → Authentication → Settings
2. Under "Email Auth" section, find "Confirm email"
3. **Disable** the "Confirm email" toggle
4. This allows users to sign up and sign in immediately without email verification

**Production Note:** Re-enable email confirmation for production apps!

### URL Configuration

1. In Supabase Dashboard → Authentication → URL Configuration, add:
   - `optimal://auth/callback` (for mobile OAuth)
   - For Expo Go development, also add your exp URL variant if needed

2. For Google OAuth:
   - Go to Authentication → Providers → Google
   - Enable the provider and add your OAuth credentials
   - Set authorized redirect URIs in Google Console

### Database Schema

Create these tables in your Supabase project:

```sql
-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workouts table
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  block TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  workout_id UUID REFERENCES workouts,
  lift TEXT NOT NULL,
  sets INTEGER NOT NULL,
  reps INTEGER[] NOT NULL,
  weight NUMERIC[] NOT NULL,
  rpe NUMERIC[],
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Goals table
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  lift TEXT NOT NULL,
  target_1rm NUMERIC NOT NULL,
  target_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS)

Enable RLS and add policies:

```sql
-- Workouts policies
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workouts"
  ON workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts"
  ON workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts"
  ON workouts FOR UPDATE
  USING (auth.uid() = user_id);

-- Sessions policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Goals policies
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own goals"
  ON goals FOR ALL
  USING (auth.uid() = user_id);
```

## 3. Features Implemented

### Authentication
- ✅ Email/Password sign-up and sign-in
- ✅ Google OAuth integration
- ✅ Session persistence with AsyncStorage
- ✅ Automatic session management
- ✅ Protected routes

### Hooks Available
- `useSupabaseUser()` - Get current authenticated user
- `useMonthlyWorkouts({ year, month })` - Fetch workouts for a month
- `useUpsertWorkout()` - Save or update a workout

### Reusable Components

#### MonthlyCalendar
```tsx
import MonthlyCalendar from '@/components/MonthlyCalendar';

<MonthlyCalendar 
  year={2025} 
  month={0}  // 0 = January
  onEdit={(dateISO) => console.log('Edit workout for', dateISO)}
/>
```

#### WorkoutEditorSheet
```tsx
import WorkoutEditorSheet from '@/components/WorkoutEditorSheet';

<WorkoutEditorSheet
  visible={showEditor}
  dateISO="2025-01-15"
  initial={{ id: '...', block: 'Upper', notes: 'Great session' }}
  onClose={() => setShowEditor(false)}
/>
```

#### ProgressCards
```tsx
import ProgressCards from '@/components/ProgressCards';

<ProgressCards />
```

## 4. Usage in Your App

The app now has session gating - users must sign in to access the tabs. The sign-in and sign-up screens include both email/password and Google OAuth options.

To use the reusable components in any screen:

```tsx
import MonthlyCalendar from '@/components/MonthlyCalendar';
import WorkoutEditorSheet from '@/components/WorkoutEditorSheet';
import ProgressCards from '@/components/ProgressCards';

// Use them wherever you want!
```

## 5. Development Notes

- The app uses `optimal` as the OAuth scheme (configured in app.json)
- Session state is automatically synced across the app
- All Supabase queries use RLS for security
- Components handle loading and error states

## 6. Next Steps

1. Set up your Supabase project and get the URL + anon key
2. Add environment variables
3. Create database tables and RLS policies
4. Configure Google OAuth (if using)
5. Test sign-in and data operations
