class ExpoMock {
  constructor() {
    this.chunkPushNotifications = (messages) => [messages];
    this.sendPushNotificationsAsync = async () => [];
    this.chunkPushNotificationReceiptIds = (ids) => [ids];
    this.getPushNotificationReceiptsAsync = async () => ({});
  }

  static isExpoPushToken() {
    return true;
  }
}

module.exports = { Expo: ExpoMock };
