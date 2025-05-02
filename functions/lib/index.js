"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEmailSettings = exports.testEmailSettings = exports.testSendMail = exports.sendMentionNotification = exports.sendTaskAssignmentNotification = void 0;
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const functions = require("firebase-functions");
admin.initializeApp();
// メール送信のためのトランスポーター設定
const createEmailTransporter = () => {
    const emailConfig = functions.config().email;
    if (!(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.user) || !(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.apppassword)) {
        throw new Error('メール設定が不完全です');
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailConfig.user,
            pass: emailConfig.apppassword
        }
    });
};
// メール設定の詳細な確認
const emailConfig = functions.config()['email'];
console.log('メール設定の確認:', {
    hasConfig: !!emailConfig,
    hasUser: !!(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.user),
    hasAppPassword: !!(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.apppassword)
});
if (!emailConfig || !emailConfig.user || !emailConfig.apppassword) {
    console.error('メール設定が不完全です。メール送信機能は使用できません。');
}
// メール送信テスト
const transporter = createEmailTransporter();
transporter.verify(function (error, success) {
    if (error) {
        console.error('メール設定エラー:', error);
    }
    else {
        console.log('メールサーバー接続成功');
    }
});
// メール送信状態の監視
async function sendMailWithConfirmation(mailOptions) {
    console.log('メール送信処理を開始します');
    try {
        const transporter = createEmailTransporter();
        console.log('メール送信の準備が完了しました:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject
        });
        const info = await transporter.sendMail(mailOptions);
        console.log('メール送信成功:', {
            messageId: info.messageId,
            response: info.response
        });
        return true;
    }
    catch (error) {
        console.error('メール送信中にエラーが発生しました:', {
            error: error.message,
            code: error.code,
            stack: error.stack
        });
        if (error.code === 'EAUTH') {
            console.error('認証エラー: メールアドレスまたはアプリパスワードが正しくありません');
        }
        else if (error.code === 'ESOCKET') {
            console.error('ソケットエラー: ネットワーク接続に問題があります');
        }
        return false;
    }
}
// タスク割り当て時の通知メール送信
exports.sendTaskAssignmentNotification = functions.firestore
    .document('tasks/{taskId}')
    .onWrite(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    // ドキュメントが削除された場合は処理しない
    if (!afterData) {
        console.log('タスクが削除されました');
        return;
    }
    // 新規作成時、または担当者が変更された時のみ通知
    const isNewTask = !beforeData;
    const assigneesChanged = beforeData &&
        JSON.stringify(beforeData.assignedUsers) !== JSON.stringify(afterData.assignedUsers);
    if (!isNewTask && !assigneesChanged) {
        console.log('担当者の変更はありません');
        return;
    }
    const assignedUsers = afterData.assignedUsers || [];
    console.log('割り当てられたユーザー:', assignedUsers);
    if (assignedUsers.length === 0) {
        console.log('割り当てられたユーザーが存在しません');
        return;
    }
    try {
        for (const assignedUser of assignedUsers) {
            const assignedUserEmail = assignedUser.email;
            console.log('割り当てられたユーザーのメールアドレス:', assignedUserEmail);
            if (!assignedUserEmail) {
                console.log('割り当てられたユーザーのメールアドレスが存在しません');
                continue;
            }
            const mailOptions = {
                from: functions.config().email.user,
                to: assignedUserEmail,
                subject: '【タスク管理アプリ】タスクが割り当てられました',
                text: `
タスクが${isNewTask ? '新規作成' : '再割り当て'}されました。

タスク名: ${afterData.title}
説明: ${afterData.content || '説明なし'}
期限: ${afterData.dueDate ? new Date(afterData.dueDate.seconds * 1000).toLocaleString() : '期限なし'}
優先度: ${afterData.priority || '未設定'}
ステータス: ${afterData.status || '未設定'}

タスクの詳細は以下のリンクから確認できます：
${process.env.FRONTEND_URL || 'http://localhost:4200'}/tasks/${context.params.taskId}
          `,
                html: `
            <h2>タスクが${isNewTask ? '新規作成' : '再割り当て'}されました</h2>
            <p><strong>タスク名:</strong> ${afterData.title}</p>
            <p><strong>説明:</strong> ${afterData.content || '説明なし'}</p>
            <p><strong>期限:</strong> ${afterData.dueDate ? new Date(afterData.dueDate.seconds * 1000).toLocaleString() : '期限なし'}</p>
            <p><strong>優先度:</strong> ${afterData.priority || '未設定'}</p>
            <p><strong>ステータス:</strong> ${afterData.status || '未設定'}</p>
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/tasks/${context.params.taskId}">タスクの詳細を確認する</a></p>
          `
            };
            console.log('メール送信を試みます:', mailOptions);
            const result = await sendMailWithConfirmation(mailOptions);
            console.log('メール送信結果:', result);
        }
    }
    catch (error) {
        console.error('タスク割り当て通知の送信中にエラーが発生しました:', error);
    }
});
// メンション時の通知メール送信
exports.sendMentionNotification = functions.firestore
    .document('messages/{messageId}')
    .onCreate(async (snap, context) => {
    console.log('メンション通知関数が開始されました');
    const messageData = snap.data();
    console.log('メッセージデータ:', messageData);
    if (!messageData || !messageData.mentions || messageData.mentions.length === 0) {
        console.log('メンション情報がありません');
        return;
    }
    console.log('メンションされたユーザー:', messageData.mentions);
    // メンションされたユーザーのメールアドレスを処理
    for (const mentionedEmail of messageData.mentions) {
        console.log('メンションされたメールアドレスを処理中:', mentionedEmail);
        // メール送信オプションを設定
        const mailOptions = {
            from: functions.config()['email'].user,
            to: mentionedEmail,
            subject: 'コメントでメンションされました',
            text: `コメントでメンションされました。\n\nコメント: ${messageData.content || '内容なし'}`,
            html: `
              <h2>コメントでメンションされました</h2>
              <p><strong>コメント:</strong> ${messageData.content || '内容なし'}</p>
              <p><strong>投稿者:</strong> ${messageData.senderName || '匿名'}</p>
            `
        };
        try {
            const success = await sendMailWithConfirmation(mailOptions);
            if (success) {
                console.log('メンション通知メールを送信しました:', mentionedEmail);
            }
            else {
                console.error('メンション通知メールの送信に失敗しました:', mentionedEmail);
            }
        }
        catch (error) {
            console.error('メンション通知メールの送信中にエラーが発生しました:', error);
        }
    }
});
exports.testSendMail = functions.https.onRequest(async (req, res) => {
    const mailOptions = {
        from: functions.config()['email'].user,
        to: 'yuki.wada@pathoslogos.co.jp',
        subject: 'テストメール',
        text: 'これはFirebase Functionsからのテストメールです'
    };
    try {
        await transporter.sendMail(mailOptions);
        res.send('メール送信成功');
    }
    catch (error) {
        res.status(500).send('メール送信失敗: ' + error);
    }
});
// テストメール送信用のHTTP関数
exports.testEmailSettings = functions.https.onRequest(async (req, res) => {
    console.log('テストメール送信を開始します');
    try {
        const mailOptions = {
            from: functions.config().email.user,
            to: functions.config().email.user,
            subject: '【タスク管理アプリ】テストメール',
            text: `これはテストメールです。
送信日時: ${new Date().toLocaleString()}

メール送信機能が正常に動作していることを確認しました。`
        };
        const result = await sendMailWithConfirmation(mailOptions);
        if (result) {
            console.log('テストメール送信成功');
            res.status(200).send({ success: true, message: 'テストメールを送信しました' });
        }
        else {
            console.error('テストメール送信失敗');
            res.status(500).send({ success: false, message: 'テストメール送信に失敗しました' });
        }
    }
    catch (error) {
        console.error('テストメール送信中にエラーが発生:', error);
        res.status(500).send({ success: false, message: 'エラーが発生しました', error: error });
    }
});
// メール設定を確認する関数
exports.checkEmailSettings = functions.https.onCall(async (data, context) => {
    console.log('メール設定の確認を開始します');
    const emailConfig = functions.config().email;
    const configStatus = {
        hasUser: !!(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.user),
        hasAppPassword: !!(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.apppassword),
        user: (emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.user) ? '設定済み' : '未設定',
        appPassword: (emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.apppassword) ? '設定済み' : '未設定'
    };
    console.log('メール設定の状態:', configStatus);
    if (!(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.user) || !(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.apppassword)) {
        console.error('メール設定が不完全です:', configStatus);
        throw new functions.https.HttpsError('failed-precondition', 'メール設定が不完全です', configStatus);
    }
    return {
        success: true,
        message: 'メール設定は正常です',
        config: configStatus
    };
});
//# sourceMappingURL=index.js.map