# Firestore Indexing & Rules for ImgXXI appointments

Recommended fields to index and why:

- `date` (single-field index): common filter to fetch appointments for a given day.
- `technique` (single-field index): filters by modality (RM / TC / Rayos X / Ultrasonido).
- `startTimeMinutes` (single-field index): numeric start time for range queries and sorting.
- `endTimeMinutes` (single-field index): used for overlap queries (optional).

Recommended composite indexes:

- `date ASC, technique ASC, startTimeMinutes ASC` — query appointments for a day and technique, ordered by start time.
- `date ASC, startTimeMinutes ASC` — fetch all appointments for a day sorted by time.

Notes about storing numeric fields:

- Save `startTimeMinutes` (minutes since midnight) and `endTimeMinutes` to make range and overlap queries efficient and avoid string parsing in queries.

Example Firestore security rules (development only):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /appointments/{docId} {
      allow read, write: if true; // development only — lock this down for production
    }
  }
}
```

How to create indexes in Firebase console:

1. Go to Firestore Database -> Indexes -> Composite Indexes -> Create index.
2. Add fields and ordering as shown in composite examples above.

If you need, I can generate the JSON index definitions you can import into Firebase CLI.
