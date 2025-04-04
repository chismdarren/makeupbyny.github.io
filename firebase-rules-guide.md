# Firebase Security Rules Guide

If you're experiencing issues with saving contact messages to your Firestore database, you may need to update your Firebase security rules to allow writing to the `contact_messages` collection.

## How to Update Firebase Security Rules

1. **Go to the Firebase Console**
   - Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Select your project: `makeupbyny-1`

2. **Navigate to Firestore Database**
   - In the left sidebar, click on "Firestore Database"

3. **Access Rules Tab**
   - At the top of the Firestore Database page, click on the "Rules" tab

4. **Update Security Rules**
   - You should see a rules editor. Replace the existing rules with the following to allow public write access to contact messages:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow admin to read and write all data
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == "yuoaYY14sINHaqtNK5EAz4nl8cc2";
    }
    
    // Allow public users to submit contact messages
    match /contact_messages/{messageId} {
      allow create: if true;  // Anyone can create a contact message
      allow read, update, delete: if request.auth != null && request.auth.uid == "yuoaYY14sINHaqtNK5EAz4nl8cc2";
    }
    
    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

5. **Publish Rules**
   - Click the "Publish" button to apply the updated rules

## Explanation of Rules

- **User Data**: Users can only read and modify their own data
- **Admin Access**: Admin user (with the specified UID) has full access to all data
- **Contact Messages**: 
  - Anyone can create a new contact message (allow create: if true)
  - Only the admin can read, update, or delete contact messages

## Testing the Rules

After updating the rules, try submitting the contact form again. If you still encounter issues, you can run the Firebase Test page (firebase-test.html) to verify your Firebase connection and permissions.

## Security Note

These rules allow anyone to submit a contact message without authentication. If you experience spam or abuse, you might want to implement additional security measures like reCAPTCHA or rate limiting.

## Troubleshooting

If you still experience issues after updating the rules:

1. Check the browser console for specific error messages
2. Verify that your Firebase configuration in `firebase-config.js` matches your Firebase project
3. Ensure that the Firestore database has been created in your Firebase project
4. Verify that your web app's Firebase SDK version is up to date 