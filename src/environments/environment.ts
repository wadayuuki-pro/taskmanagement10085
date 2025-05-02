export const environment = {
    production: false,
    firebase: {
        apiKey: "AIzaSyBZof8WkeZFBxUfk7tOixVxw16yBldSCSc",
        authDomain: "kensyu10085.firebaseapp.com",
        databaseURL: "https://kensyu10085-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "kensyu10085",
        storageBucket: "kensyu10085.firebasestorage.app",
        messagingSenderId: "676207024399",
        appId: "1:676207024399:web:233ae37594d5359b45867a",
        measurementId: "G-P6Y94FKR70"
    },
    googleCalendar:{
        apiKey: "AIzaSyDmfkVq12_N9IYr2IDVuXmhIAQleAr2cN0",
        clientId: "676207024399-740pfsn64j5qfihbquii4pukjos819iu.apps.googleusercontent.com",
    },
    googleDrive: {
        apiKey: "AIzaSyDmfkVq12_N9IYr2IDVuXmhIAQleAr2cN0",
        clientId: "676207024399-740pfsn64j5qfihbquii4pukjos819iu.apps.googleusercontent.com",
        scope: [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.metadata.readonly"
        ].join(' ')
    }
  };