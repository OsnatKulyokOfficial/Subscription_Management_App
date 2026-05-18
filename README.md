# 🏋️ אפליקציית ניהול אימונים

אפליקציה מינימליסטית לניהול קבוצות אימון — צד מתאמן וצד מאמן.

---

## הגדרת Supabase (חובה לפני הרצה)

### שלב 1: צור פרויקט Supabase
1. כנס ל־ https://supabase.com וצור חשבון חינמי
2. צור פרויקט חדש (שמור את הסיסמה)
3. המתן עד שהפרויקט יקום (~2 דקות)

### שלב 2: הרץ את ה-Schema
1. לך ל **SQL Editor** בלוח הבקרה של Supabase
2. פתח את הקובץ `supabase/schema.sql` מהפרויקט
3. הדבק ולחץ **Run**

### שלב 3: הגדר Phone Auth
1. לך ל **Authentication → Providers → Phone**
2. הפעל Phone Auth
3. להרצת SMS אמיתי: חבר Twilio (Account SID + Auth Token + Phone Number)
4. לסביבת פיתוח: אפשר **"Disable phone confirmations"** — ואז הקוד יהיה `123456`

### שלב 4: קובץ סביבה
```bash
cp .env.local.example .env.local
```
מלא את הערכים מ **Settings → API** בדאשבורד של Supabase:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### שלב 5: הגדר את המאמן
1. כנס לאפליקציה עם מספר הטלפון שלך (יצטרף כ"מתאמן")
2. לך ל Supabase → **Table Editor → users**
3. עדכן את השורה שלך: `role = 'coach'` ו-`name = 'השם שלך'`

---

## הרצה מקומית

```bash
cd training-app
npm install
npm run dev
```

פתח את הדפדפן על: http://localhost:3000

---

## מבנה האפליקציה

```
/ ← כניסה (מספר טלפון)
/verify ← אימות OTP
/trainee ← לוח מתאמן (לוח שבועי + כפתורי הרשמה)
/coach ← לוח מאמן ראשי
/coach/groups ← ניהול קבוצות + גרירה
/coach/sessions ← הוספה/עריכה/ביטול אימונים
/coach/attendance ← סימון נוכחות
/coach/reports ← דוחות חודשיים
```

---

## מה בנינו

| תכונה | פרטים |
|-------|--------|
| 🔐 כניסה | OTP למספר טלפון בלבד |
| 📅 לוח שבועי | מתאמן רואה את האימונים שלו לפי שבוע |
| ✅ הרשמה | כפתור "מגיע/לא מגיע" גדול וברור |
| 👥 קבוצות | גרירת מתאמנים בין קבוצות (Drag & Drop) |
| ➕ ניהול אימונים | אימון קבוע שבועי / חד-פעמי, עריכה, ביטול |
| ✔️ נוכחות | סימון הגיע/לא הגיע לכל מתאמן בכל אימון |
| 📊 דוחות | סיכום חודשי עם % נוכחות לכל מתאמן |
| 🔔 התראות | לוג התראות על שינויים (SMS — מחייב Twilio) |

---

## Deploy (אופציונלי)

לפרסום ב-Vercel בחינם:
```bash
npm install -g vercel
vercel
```
הוסף את משתני הסביבה ב-Vercel Dashboard.
